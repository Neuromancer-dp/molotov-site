// Molotov Studios — scroll-driven three.js centerpiece
// A faceted solid that shatters into its own faces. Every shard is one real
// triangle of an icosphere: scrolling through #centerpiece-section pulls them
// out of a scattered cloud along curved, staggered paths and locks them back
// into place. Progress is a pure function of scroll position (then damped for
// feel), so scrubbing up/down is fully reversible with no accumulated state.

(function () {
  'use strict';

  var canvas = document.getElementById('centerpiece-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var section = document.getElementById('centerpiece-section');
  var stage = canvas.parentElement;
  var statusEl = document.getElementById('centerpiece-status');
  var percentEl = document.getElementById('centerpiece-percent');
  var fillEl = document.getElementById('centerpiece-fill');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 640px)').matches;
  var hasFinePointer = window.matchMedia('(pointer: fine)').matches;

  // Site palette (kept in sync with css/style.css custom properties).
  var COLOR_TEXT = 0xe8e3d3;
  var COLOR_MUTED = 0x8b8578;
  var COLOR_BORDER = 0x2a2822;
  var COLOR_ACCENT = 0xc9a876;

  var SHAPE_RADIUS = 1.7;
  var SHARD_FILL = 0.9;        // <1 leaves a hairline gap between shards
  var MAX_DELAY = 0.38;        // fraction of scroll spent staggering starts
  var DUST_COUNT = isMobile ? 90 : 240;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var BASE_CAM_Z = 6.2;
  camera.position.set(0, 0, BASE_CAM_Z);

  // ---- Lighting ---------------------------------------------------------
  scene.add(new THREE.AmbientLight(COLOR_MUTED, 0.35));
  var keyLight = new THREE.DirectionalLight(COLOR_TEXT, 1.0);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(COLOR_ACCENT, 1.4);
  rimLight.position.set(-4, -1, -3);
  scene.add(rimLight);
  var coreLight = new THREE.PointLight(COLOR_ACCENT, 0, 6, 2);
  scene.add(coreLight);

  // Tiny studio "environment" (dark room + a few soft light cards) baked to a
  // PMREM so the metal shards pick up long, clean reflections as they turn.
  try {
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x050504);
    var cards = [
      { c: 0xfff1d6, s: [6, 1.4], p: [0, 5, 2], r: [Math.PI / 2.4, 0, 0], i: 1.0 },
      { c: 0xc9a876, s: [1.4, 7], p: [-6, 0, 1], r: [0, Math.PI / 2.2, 0], i: 0.9 },
      { c: 0xe8e3d3, s: [1.2, 6], p: [6, -1, -1], r: [0, -Math.PI / 2.2, 0], i: 0.6 },
      { c: 0x8b8578, s: [8, 1], p: [0, -5, 0], r: [-Math.PI / 2.4, 0, 0], i: 0.5 },
    ];
    cards.forEach(function (d) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(d.s[0], d.s[1]),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(d.c).multiplyScalar(d.i * 2.2), side: THREE.DoubleSide })
      );
      m.position.set(d.p[0], d.p[1], d.p[2]);
      m.rotation.set(d.r[0], d.r[1], d.r[2]);
      envScene.add(m);
    });
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  } catch (e) { /* falls back to direct lights only */ }

  var group = new THREE.Group();
  scene.add(group);

  // ---- Shards: one instance per icosphere face --------------------------
  var ico = new THREE.IcosahedronGeometry(SHAPE_RADIUS, 1);
  var pos = ico.attributes.position;
  var COUNT = pos.count / 3;

  // Thin beveled triangular prism, unit circumradius, centered on its centroid.
  var tri = new THREE.Shape();
  for (var v = 0; v < 3; v++) {
    var a = Math.PI / 2 + (v * Math.PI * 2) / 3;
    if (v === 0) tri.moveTo(Math.cos(a), Math.sin(a));
    else tri.lineTo(Math.cos(a), Math.sin(a));
  }
  tri.closePath();
  var DEPTH = 0.1;
  var shardGeometry = new THREE.ExtrudeGeometry(tri, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: -0.02,
    bevelSegments: 1,
  });
  shardGeometry.translate(0, 0, -DEPTH / 2);

  var shardMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.92,
    envMapIntensity: 0.75,
  });
  var shards = new THREE.InstancedMesh(shardGeometry, shardMaterial, COUNT);
  group.add(shards);

  var targetPos = [];
  var targetQuat = [];
  var targetScale = [];
  var scatterUnit = [];   // unit-ish random vectors, stretched in layoutScatter()
  var scatterQuat = [];
  var tumbleAxis = [];
  var tumbleAmt = [];
  var phase = [];
  var delay = [];

  var pa = new THREE.Vector3();
  var pb = new THREE.Vector3();
  var pc = new THREE.Vector3();
  var basisX = new THREE.Vector3();
  var basisY = new THREE.Vector3();
  var basisZ = new THREE.Vector3();
  var basisM = new THREE.Matrix4();
  var tmpColor = new THREE.Color();
  var cDark = new THREE.Color(0x1c1a16);
  var cBone = new THREE.Color(COLOR_TEXT);
  var cGold = new THREE.Color(COLOR_ACCENT);

  for (var i = 0; i < COUNT; i++) {
    pa.fromBufferAttribute(pos, i * 3);
    pb.fromBufferAttribute(pos, i * 3 + 1);
    pc.fromBufferAttribute(pos, i * 3 + 2);

    var centroid = new THREE.Vector3().add(pa).add(pb).add(pc).multiplyScalar(1 / 3);
    basisZ.subVectors(pb, pa).cross(pc.clone().sub(pa)).normalize();
    if (basisZ.dot(centroid) < 0) basisZ.negate();
    basisY.subVectors(pa, centroid).normalize();
    basisX.crossVectors(basisY, basisZ).normalize();
    basisM.makeBasis(basisX, basisY, basisZ);

    targetPos.push(centroid);
    targetQuat.push(new THREE.Quaternion().setFromRotationMatrix(basisM));
    var circumR = (pa.distanceTo(centroid) + pb.distanceTo(centroid) + pc.distanceTo(centroid)) / 3;
    targetScale.push(circumR * SHARD_FILL);

    scatterUnit.push(new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize().multiplyScalar(0.45 + Math.random() * 0.55));
    scatterQuat.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    )));
    tumbleAxis.push(new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize());
    tumbleAmt.push(2 + Math.random() * 4);
    phase.push(Math.random() * Math.PI * 2);

    // Assemble roughly bottom -> top with jitter so it reads as a wave.
    var h = centroid.y / SHAPE_RADIUS * 0.5 + 0.5;
    delay.push(((1 - h) * 0.6 + Math.random() * 0.4) * MAX_DELAY);

    // Mostly dark warm metal, a few bone and gold accents.
    var roll = Math.random();
    if (roll < 0.14) tmpColor.copy(cGold);
    else if (roll < 0.28) tmpColor.copy(cBone).lerp(cDark, 0.55);
    else tmpColor.copy(cDark).lerp(cBone, Math.random() * 0.22);
    shards.setColorAt(i, tmpColor);
  }
  ico.dispose();
  shards.instanceColor.needsUpdate = true;

  var scatters = [];
  for (var s = 0; s < COUNT; s++) scatters.push(new THREE.Vector3());

  // Scatter cloud is an ellipsoid matched to the viewport so wide screens use
  // their width and portrait screens don't throw shards off-canvas.
  function layoutScatter(aspect) {
    var sx = Math.min(2.2, Math.max(0.8, aspect * 0.78)) * 4.4;
    var sy = aspect < 1 ? 4.2 : 3.3;
    var sz = 2.1;
    for (var k = 0; k < COUNT; k++) {
      scatters[k].set(scatterUnit[k].x * sx, scatterUnit[k].y * sy, scatterUnit[k].z * sz - 1.2);
    }
  }

  // ---- Core glow, cage, dust -------------------------------------------
  function radialTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  var dotTexture = radialTexture();

  var glowMaterial = new THREE.SpriteMaterial({
    map: dotTexture,
    color: COLOR_ACCENT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  var glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(6.5);
  glow.position.z = -1.2;
  group.add(glow);

  var coreMaterial = new THREE.MeshBasicMaterial({
    color: COLOR_ACCENT,
    transparent: true,
    opacity: 0,
  });
  var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), coreMaterial);
  group.add(core);

  // Ember spark: hot additive bloom around the kernel that pulses once formed.
  var sparkMaterial = new THREE.SpriteMaterial({
    map: dotTexture,
    color: 0xfff1d6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  var spark = new THREE.Sprite(sparkMaterial);
  group.add(spark);

  // Gyroscope: three thin rings on different axes orbiting the kernel.
  var gyro = new THREE.Group();
  group.add(gyro);
  var rings = [
    { r: 0.62, tilt: [0, 0, 0], speed: [0.9, 0.2, 0] },
    { r: 0.86, tilt: [Math.PI / 2.6, 0, 0.5], speed: [-0.3, 0.7, 0.1] },
    { r: 1.1, tilt: [0.4, Math.PI / 3, 1.0], speed: [0.15, -0.5, 0.4] },
  ].map(function (d) {
    var mat = new THREE.MeshBasicMaterial({
      color: COLOR_ACCENT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var mesh = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.011, 6, isMobile ? 64 : 128), mat);
    mesh.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
    gyro.add(mesh);
    return { mesh: mesh, mat: mat, speed: d.speed, tilt: d.tilt };
  });

  // Hairline edge cage, revealed as the form locks in.
  var cageMaterial = new THREE.LineBasicMaterial({
    color: COLOR_ACCENT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  var cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(SHAPE_RADIUS * 1.04, 1)),
    cageMaterial
  );
  group.add(cage);

  // Outer wireframe orbit that stays faint, gives depth to the finished form.
  var haloMaterial = new THREE.LineBasicMaterial({
    color: COLOR_BORDER,
    transparent: true,
    opacity: 0,
  });
  var halo = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(SHAPE_RADIUS * 1.6, 0)),
    haloMaterial
  );
  group.add(halo);

  var dustGeometry = new THREE.BufferGeometry();
  var dustPositions = new Float32Array(DUST_COUNT * 3);
  for (var d = 0; d < DUST_COUNT; d++) {
    var dv = new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize().multiplyScalar(4 + Math.random() * 6);
    dustPositions[d * 3] = dv.x * 1.3;
    dustPositions[d * 3 + 1] = dv.y;
    dustPositions[d * 3 + 2] = dv.z - 2;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  var dustMaterial = new THREE.PointsMaterial({
    map: dotTexture,
    color: COLOR_TEXT,
    size: 0.09,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  var dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // ---- Motion -----------------------------------------------------------
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function smoothstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  var target = reduceMotion ? 1 : 0;   // raw scroll progress
  var progress = target;               // damped progress actually rendered
  var idleAngle = 0;
  var elapsed = 0;
  var pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  var dummy = new THREE.Object3D();
  var tumbleQ = new THREE.Quaternion();
  var offset = new THREE.Vector3();
  var Y_AXIS = new THREE.Vector3(0, 1, 0);
  var lastPercent = -1;
  var lastDone = null;

  function updateHud() {
    var pct = Math.round(progress * 100);
    if (pct !== lastPercent) {
      lastPercent = pct;
      if (percentEl) percentEl.textContent = String(pct).padStart(3, '0') + '%';
      if (fillEl) fillEl.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    }
    var done = progress > 0.995;
    if (done !== lastDone) {
      lastDone = done;
      if (statusEl) statusEl.textContent = done ? 'ASSEMBLY COMPLETE' : 'ASSEMBLY IN PROGRESS';
    }
  }

  function update() {
    var span = 1 - MAX_DELAY;
    var lock = smoothstep(0.82, 1, progress);
    var swell = smoothstep(0.35, 1, progress);
    // After lock-in the shell breathes open a few percent to show the ember.
    var open = lock * (0.16 + 0.07 * Math.sin(elapsed * 1.1));
    for (var i = 0; i < COUNT; i++) {
      var t = Math.min(1, Math.max(0, (progress - delay[i]) / span));
      var e = easeInOutCubic(t);
      var inv = 1 - e;

      // Curved path: the scatter offset swirls around Y as it collapses.
      offset.subVectors(scatters[i], targetPos[i]).applyAxisAngle(Y_AXIS, inv * 1.4);
      dummy.position.copy(targetPos[i]).multiplyScalar(1 + open).addScaledVector(offset, inv);

      // Loose drift while unassembled.
      var drift = inv * 0.16;
      dummy.position.x += Math.sin(elapsed * 0.7 + phase[i]) * drift;
      dummy.position.y += Math.cos(elapsed * 0.6 + phase[i] * 1.3) * drift;

      dummy.quaternion.slerpQuaternions(scatterQuat[i], targetQuat[i], e);
      tumbleQ.setFromAxisAngle(tumbleAxis[i], inv * inv * tumbleAmt[i]);
      dummy.quaternion.premultiply(tumbleQ);

      // Shards swell slightly as they lock in.
      dummy.scale.setScalar(targetScale[i] * (0.55 + 0.45 * e));

      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;

    cageMaterial.opacity = lock * 0.35;
    haloMaterial.opacity = swell * 0.35;
    var pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
    coreMaterial.opacity = lock;
    core.scale.setScalar((0.4 + lock * 0.6) * (1 + pulse * 0.12));
    core.rotation.set(elapsed * 0.6, elapsed * 0.9, 0);
    sparkMaterial.opacity = lock * (0.35 + pulse * 0.25);
    spark.scale.setScalar(1.5 + pulse * 0.35);
    gyro.scale.setScalar(0.6 + lock * 0.4);
    rings.forEach(function (rg) {
      rg.mat.opacity = lock * 0.9;
      rg.mesh.rotation.set(
        rg.tilt[0] + elapsed * rg.speed[0],
        rg.tilt[1] + elapsed * rg.speed[1],
        rg.tilt[2] + elapsed * rg.speed[2]
      );
    });
    glowMaterial.opacity = swell * 0.32 + lock * 0.18;
    coreLight.intensity = lock * (5 + pulse * 3);

    // Ease pointer toward the cursor for a soft parallax.
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;

    group.rotation.y = idleAngle + easeInOutCubic(progress) * Math.PI * 0.6 + pointer.sx * 0.35;
    group.rotation.x = easeInOutCubic(progress) * 0.25 + pointer.sy * 0.22;
    cage.rotation.y = -elapsed * 0.05;
    halo.rotation.set(elapsed * 0.06, -elapsed * 0.08, 0);
    dust.rotation.y = elapsed * 0.012 + pointer.sx * 0.05;
    dust.rotation.x = pointer.sy * 0.04;
    dustMaterial.opacity = 0.55 - swell * 0.3;

    camera.position.x = pointer.sx * 0.25;
    camera.position.y = -pointer.sy * 0.18;
    camera.lookAt(0, 0, 0);

    updateHud();
  }

  function resize() {
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    var aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    // Pull back on narrow viewports so the finished form always fits.
    camera.position.z = BASE_CAM_Z * Math.min(1.9, Math.max(1, 0.82 / aspect));
    camera.updateProjectionMatrix();
    layoutScatter(aspect);
  }

  resize();
  window.addEventListener('resize', resize);

  update();
  renderer.render(scene, camera);

  if (reduceMotion) return;

  if (hasFinePointer) {
    window.addEventListener('pointermove', function (ev) {
      pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (ev.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // Only spend GPU time while the section is on screen.
  var visible = true;
  if ('IntersectionObserver' in window && section) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { rootMargin: '10% 0px' }).observe(section);
  }

  var clock = new THREE.Clock();
  function tick() {
    var dt = Math.min(0.05, clock.getDelta());
    if (visible) {
      elapsed += dt;
      idleAngle += dt * 0.12;
      // Frame-rate independent damping toward the scroll target.
      progress += (target - progress) * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - progress) < 0.0005) progress = target;
      update();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap && section) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) {
        target = self.progress;
      },
    });
  }
})();
