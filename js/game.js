class GameController {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.castle = null;
        
        // Game states
        this.gold = 300; // Starting gold for testing
        this.wave = 1;
        this.score = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.selectedShopItem = null; 
        this.bossActive = false;
        
        // Arrays for tracking game objects
        this.enemies = [];
        this.defenders = [];
        this.allies = []; // Melee Allies (soldier, general, princess)
        this.projectiles = [];
        this.cacti = []; // Decorative moving elements

        // Controls
        this.keys = {
            w: false, a: false, s: false, d: false,
            W: false, A: false, S: false, D: false,
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
        };
        this.castleVelocity = new THREE.Vector3();

        // Raycasting & Interaction
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.hoveredSlotMesh = null;

        // Wave control
        this.waveTimer = 0;
        this.waveDuration = 20000; // 20 seconds per wave
        this.spawnTimer = 0;
        this.spawnInterval = 3000; // spawn every 3 seconds initially
        
        // Performance
        this.clock = new THREE.Clock();

        // Kills & State Effects
        this.totalKills = 0;
        this.castleFrozenTimer = 0;
        this.cameraShakeTimer = 0;

        // Background Music
        this.bgMusic = new Audio('audio/Iron Gate Riot.mp3');
        this.bgMusic.loop = true;
        this.musicEnabled = true;
    }

    init() {
        // Setup Three.js
        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdca170); // Warm desert orange sky
        this.scene.fog = new THREE.FogExp2(0xdca170, 0.025); // Desert dust fog

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 10, 18);
        this.camera.lookAt(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xfff0e0, 0.7);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffe5cc, 1.2);
        sunLight.position.set(10, 20, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 40;
        const d = 20;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        this.scene.add(sunLight);

        // Ground (Desert with gravel and water pools)
        const loader = new THREE.TextureLoader();
        const groundTex = window.loadGameTexture(loader, 'assets/ground/gravel_desert.png');
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(30, 30); // repeat平鋪
        
        const groundGeom = new THREE.PlaneGeometry(300, 300);
        const groundMat = new THREE.MeshPhongMaterial({ 
            map: groundTex, 
            shininess: 5
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Create Castle
        this.castle = new Castle(this.scene);

        // Spawn decorative moving Cacti
        this.spawnCacti();

        // Event listeners
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
        window.addEventListener('click', (e) => this.onClick(e));
        
        // Key controls for keyboard movement
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        this.updateHUD();
        this.animate();
    }

    onKeyDown(e) {
        if (e.key in this.keys) {
            this.keys[e.key] = true;
        }
    }

    onKeyUp(e) {
        if (e.key in this.keys) {
            this.keys[e.key] = false;
        }
    }

    spawnCacti() {
        const types = ['tree_big', 'tree_medium', 'tree_crow', 'cactus'];
        const loader = new THREE.TextureLoader();
        
        for (let i = 0; i < 45; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            
            // Redirect all tree types to use the AI-generated tree_big asset,
            // while cactus remains as a separate cactus asset.
            const texName = type === 'cactus' ? 'cactus' : 'tree_big';
            const texture = window.loadGameTexture(loader, `assets/tree/${texName}.png`);
            texture.minFilter = THREE.LinearFilter;
            
            const mat = new THREE.MeshPhongMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1, // Clean shadows
                side: THREE.DoubleSide,
                shininess: 10
            });
            
            // Random height and width based on type
            let h, w;
            if (type === 'cactus') {
                h = 1.0 + Math.random() * 0.8;
                w = h * 0.8;
            } else if (type === 'tree_medium') {
                h = 1.4 + Math.random() * 0.5; // Medium tree scale
                w = h * 0.95;
            } else if (type === 'tree_crow') {
                h = 0.9 + Math.random() * 0.4; // Small tree scale
                w = h * 0.95;
            } else { // tree_big
                h = 2.4 + Math.random() * 1.0; // Big tree scale
                w = h * 1.0;
            }
            
            const geom = new THREE.PlaneGeometry(w, h);
            geom.translate(0, h / 2, 0); // Origin at bottom center
            
            const mesh = new THREE.Mesh(geom, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Set random position in world
            mesh.position.set(
                (Math.random() - 0.5) * 120,
                0,
                (Math.random() - 0.5) * 120
            );
            
            this.scene.add(mesh);
            this.cacti.push(mesh);
        }
    }

    startNewGame() {
        // Reset state
        this.gold = 300;
        this.wave = 1;
        this.score = 0;
        this.gameOver = false;
        this.selectedShopItem = null;
        this.bossActive = false;

        // Clear arrays
        this.enemies.forEach(e => e.destroy());
        this.enemies = [];

        this.defenders.forEach(d => d.destroy());
        this.defenders = [];
        this.castle.slots.forEach(slot => slot.defender = null);

        this.allies.forEach(a => a.destroy());
        this.allies = [];

        this.projectiles.forEach(p => p.destroy());
        this.projectiles = [];

        // Reset castle position & rotation
        this.castle.mesh.position.set(0, 0, 0);
        this.castle.mesh.rotation.set(0, 0, 0);
        this.castle.position.set(0, 0, 0);
        this.castle.updateHealthBar();
        this.camera.position.set(0, 10, 18);
        this.camera.lookAt(0, 1, 0);

        this.castle.health = this.castle.maxHealth;
        this.castle.updateHealthBar();
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 3000;

        this.totalKills = 0;
        this.castleFrozenTimer = 0;
        this.cameraShakeTimer = 0;

        const existingWarning = document.getElementById('earthquake-warning');
        if (existingWarning) existingWarning.remove();

        if (this.musicEnabled) {
            this.bgMusic.play().catch(err => console.log("Music play blocked by browser:", err));
        }

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        
        this.updateHUD();
        this.gameStarted = true;
    }

    spawnProjectile(start, target, type, damage) {
        const proj = new Projectile(this.scene, start, target, type, damage);
        this.projectiles.push(proj);
    }

    applyAoEDamage(position, radius, damage) {
        this.enemies.forEach(enemy => {
            if (enemy.active) {
                // Calculate 2D distance on XZ plane
                const dist = this.getXZDistance(enemy.mesh.position, position);
                if (dist <= radius) {
                    const died = enemy.takeDamage(damage);
                    if (died) {
                        this.registerKill(enemy);
                    }
                }
            }
        });
    }

    getXZDistance(pos1, pos2) {
        return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
    }

    spawnHealEffect(position) {
        const loader = new THREE.TextureLoader();
        const healTex = window.loadGameTexture(loader, 'assets/ground/heal.png');
        const healGeom = new THREE.PlaneGeometry(0.4, 0.4);
        const healMat = new THREE.MeshBasicMaterial({ 
            map: healTex, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const particle = new THREE.Mesh(healGeom, healMat);
        particle.position.copy(position);
        this.scene.add(particle);

        let startTime = Date.now();
        const animFixed = () => {
            const t = (Date.now() - startTime) / 1000;
            if (t < 1) {
                particle.position.y += 0.04;
                particle.material.opacity = 0.9 * (1 - t);
                // Keep billboarding to face camera
                particle.quaternion.copy(this.camera.quaternion);
                requestAnimationFrame(animFixed);
            } else {
                this.scene.remove(particle);
                healGeom.dispose();
                healMat.dispose();
            }
        };
        animFixed();
    }

    updateHUD() {
        document.getElementById('gold-value').innerText = this.gold;
        document.getElementById('wave-value').innerText = this.wave;
        document.getElementById('health-value').innerText = this.castle.health;
        document.getElementById('score-value').innerText = this.score;

        // Enable/disable shop buttons
        const buyArcherBtn = document.getElementById('buy-archer-btn');
        const buyAxemanBtn = document.getElementById('buy-axeman-btn');
        const buyCrossbowBtn = document.getElementById('buy-crossbow-btn');
        const buyBomberBtn = document.getElementById('buy-bomber-btn');
        
        const spawnSoldierBtn = document.getElementById('spawn-soldier-btn');
        const spawnGeneralBtn = document.getElementById('spawn-general-btn');
        const spawnPrincessBtn = document.getElementById('spawn-princess-btn');
        const repairBtn = document.getElementById('repair-castle-btn');

        const limitReached = this.defenders.length >= 4;

        if (buyArcherBtn) buyArcherBtn.disabled = this.gold < 80 || limitReached;
        if (buyAxemanBtn) buyAxemanBtn.disabled = this.gold < 120 || limitReached;
        if (buyCrossbowBtn) buyCrossbowBtn.disabled = this.gold < 150 || limitReached;
        if (buyBomberBtn) buyBomberBtn.disabled = this.gold < 180 || limitReached;

        if (spawnSoldierBtn) spawnSoldierBtn.disabled = this.gold < 50;
        if (spawnGeneralBtn) spawnGeneralBtn.disabled = this.gold < 120;
        if (spawnPrincessBtn) spawnPrincessBtn.disabled = this.gold < 180;
        if (repairBtn) repairBtn.disabled = this.gold < 50 || this.castle.health === this.castle.maxHealth;

        // Weather magic button update
        const weatherBtn = document.getElementById('weather-magic-btn');
        const weatherKillsText = document.getElementById('weather-kills-count');
        if (weatherKillsText) {
            weatherKillsText.innerText = `${this.totalKills}/100 💀`;
        }
        if (weatherBtn) {
            weatherBtn.disabled = this.totalKills < 100 || this.gameOver || !this.gameStarted;
        }
    }

    selectShopItem(item) {
        if (this.gameOver) return;

        // Auto deploy to first free slot immediately on clicking button
        if (['archer', 'axeman', 'crossbow', 'bomber'].includes(item)) {
            const cost = item === 'archer' ? 80 : (item === 'axeman' ? 120 : (item === 'crossbow' ? 150 : 180));
            if (this.gold >= cost && this.defenders.length < 4) {
                // Find first free slot
                const freeSlot = this.castle.slots.find(s => s.defender === null);
                if (freeSlot) {
                    this.gold -= cost;
                    const def = new Defender(this.scene, freeSlot.position, freeSlot.position, this.castle.mesh, item);
                    freeSlot.defender = def;
                    this.defenders.push(def);

                    // Flash slot platform green visual feedback
                    const slotMesh = this.castle.slotMeshes[freeSlot.id];
                    if (slotMesh) {
                        const origMat = slotMesh.material;
                        slotMesh.material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                        setTimeout(() => {
                            if (slotMesh) slotMesh.material = origMat;
                        }, 250);
                    }
                    this.updateHUD();
                } else {
                    alert("城堡所有甲板平台已滿！");
                }
            }
        } else if (item === 'repair') {
            if (this.gold >= 50 && this.castle.health < this.castle.maxHealth) {
                this.gold -= 50;
                this.castle.repair(100);
                this.updateHUD();
            }
        }
        this.updateHUD();
    }

    spawnMeleeAlly(type) {
        if (this.gameOver || !this.gameStarted) return;
        const cost = type === 'soldier' ? 50 : (type === 'general' ? 120 : 180);
        
        if (this.gold >= cost) {
            this.gold -= cost;
            const ally = new Ally(this.scene, this.castle.position, type);
            this.allies.push(ally);
            this.updateHUD();
        }
    }

    onPointerMove(e) {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    onClick(e) {
        // No manual 3D click raycasting required for deploying anymore!
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    triggerGameOver() {
        this.gameOver = true;
        this.gameStarted = false;
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = Math.min(this.clock.getDelta(), 0.1); 

        if (this.gameStarted && !this.gameOver) {
            this.updateGameplay(deltaTime);
        }

        this.castle.update(deltaTime);
        this.updateEnvironment(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }

    updateGameplay(deltaTime) {
        // 0. Castle keyboard controls with Steering
        let rotationInput = 0;
        let speedInput = 0;
        
        const rotationSpeed = 1.8; 
        const moveSpeed = 6.0;

        // Update castle frozen timer
        if (this.castleFrozenTimer > 0) {
            this.castleFrozenTimer -= deltaTime;
            if (this.castleFrozenTimer <= 0) {
                this.castleFrozenTimer = 0;
                this.castle.mesh.position.y = 0;
            } else {
                this.castle.mesh.position.y = -0.4;
            }
        }

        if (this.castleFrozenTimer <= 0) {
            if (this.keys.ArrowLeft || this.keys.a || this.keys.A) rotationInput += 1;
            if (this.keys.ArrowRight || this.keys.d || this.keys.D) rotationInput -= 1;

            if (this.keys.ArrowUp || this.keys.w || this.keys.W) speedInput += 1;
            if (this.keys.ArrowDown || this.keys.s || this.keys.S) speedInput -= 1;
        }

        if (rotationInput !== 0 && this.castleFrozenTimer <= 0) {
            this.castle.mesh.rotation.y += rotationInput * rotationSpeed * deltaTime;
        }

        if (speedInput !== 0 && this.castleFrozenTimer <= 0) {
            const angle = this.castle.mesh.rotation.y;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
            
            this.castle.mesh.position.addScaledVector(dir, speedInput * moveSpeed * deltaTime);
            this.castle.mesh.position.x = Math.max(-80, Math.min(80, this.castle.mesh.position.x));
            this.castle.mesh.position.z = Math.max(-80, Math.min(80, this.castle.mesh.position.z));
            
            this.castle.position.copy(this.castle.mesh.position);
            this.castleVelocity.copy(dir).multiplyScalar(speedInput * moveSpeed);
        } else {
            this.castleVelocity.set(0, 0, 0);
        }

        // Update camera position to follow behind the castle heading smoothly
        const followCamDist = 18;
        const followCamHeight = 10;
        const castleRotY = this.castle.mesh.rotation.y;
        
        const targetCamX = this.castle.position.x - Math.sin(castleRotY) * followCamDist;
        const targetCamZ = this.castle.position.z - Math.cos(castleRotY) * followCamDist;
        const targetCamY = this.castle.position.y + followCamHeight;

        let finalCamX = targetCamX;
        let finalCamY = targetCamY;
        let finalCamZ = targetCamZ;

        // Apply camera shake if timer active
        if (this.cameraShakeTimer > 0) {
            this.cameraShakeTimer -= deltaTime;
            if (this.cameraShakeTimer < 0) this.cameraShakeTimer = 0;
            const shakeIntensity = 0.25;
            finalCamX += (Math.random() - 0.5) * shakeIntensity;
            finalCamY += (Math.random() - 0.5) * shakeIntensity;
            finalCamZ += (Math.random() - 0.5) * shakeIntensity;
        }

        this.camera.position.x += (finalCamX - this.camera.position.x) * 0.1;
        this.camera.position.y += (finalCamY - this.camera.position.y) * 0.1;
        this.camera.position.z += (finalCamZ - this.camera.position.z) * 0.1;
        this.camera.lookAt(this.castle.position.x, this.castle.position.y + 1, this.castle.position.z);

        if (this.castle.healthBar) {
            this.castle.healthBar.quaternion.copy(this.camera.quaternion);
        }

        // 1. Spawning system
        this.spawnTimer += deltaTime * 1000;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }

        // 2. Wave controller
        this.waveTimer += deltaTime * 1000;
        if (this.waveTimer >= this.waveDuration) {
            this.waveTimer = 0;
            this.wave++;
            this.score += 100;
            this.spawnInterval = Math.max(1000, 3000 - (this.wave * 200));
            this.updateHUD();

            if (this.wave === 4) {
                this.bossActive = true;
                const alertDiv = document.createElement('div');
                alertDiv.innerText = "⚠️ 警告：可愛大魔龍已降臨！";
                alertDiv.style.cssText = "position:absolute; top:90px; left:50%; transform:translateX(-50%); color:red; font-size:1.8rem; font-weight:800; z-index:99; background:rgba(0,0,0,0.7); padding:10px 30px; border-radius:10px; border:2px solid red;";
                document.body.appendChild(alertDiv);
                setTimeout(() => alertDiv.remove(), 4000);
            }
        }

        // 3. Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.active) {
                this.enemies.splice(i, 1);
                if (enemy.type === 'dragon') {
                    this.bossActive = false;
                }
                continue;
            }
            
            enemy.update(deltaTime, this.castle.position, this);

            // Check if reached castle
            const dist2D = this.getXZDistance(enemy.mesh.position, this.castle.position);
            if (dist2D < 2.5) {
                const isDead = this.castle.takeDamage(enemy.damage);
                this.updateHUD();
                enemy.die();

                if (isDead) {
                    this.triggerGameOver();
                    return;
                }
            }
        }

        // 4. Update Melee Allies (Soldier, General, Princess)
        for (let i = this.allies.length - 1; i >= 0; i--) {
            const ally = this.allies[i];
            if (!ally.active) {
                this.allies.splice(i, 1);
                continue;
            }

            ally.update(deltaTime, this.enemies, this.castle, this, this.camera);
        }

        // 5. Update Defenders
        this.defenders.forEach(def => {
            def.update(this.enemies, this);
        });

        // 6. Update Projectiles & Check Hits (using X-Z plane 2D collision check)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            if (!proj.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            proj.update(deltaTime);

            if (proj.type === 'bone' || proj.type === 'fireball' || proj.type === 'magic_bolt') {
                let hitTarget = false;
                for (let ally of this.allies) {
                    if (ally.active && this.getXZDistance(proj.mesh.position, ally.mesh.position) < 1.0) {
                        ally.takeDamage(proj.damage);
                        proj.destroy();
                        hitTarget = true;
                        break;
                    }
                }
                
                if (!hitTarget) {
                    const distToCastle = this.getXZDistance(proj.mesh.position, this.castle.position);
                    if (distToCastle < 2.2) {
                        const isDead = this.castle.takeDamage(proj.damage);
                        this.updateHUD();
                        proj.destroy();
                        if (isDead) {
                            this.triggerGameOver();
                            return;
                        }
                    }
                }
            } else if (proj.type !== 'bomb') {
                for (let enemy of this.enemies) {
                    if (!enemy.active) continue;
                    const distToEnemyXZ = this.getXZDistance(proj.mesh.position, enemy.mesh.position);
                    if (distToEnemyXZ < 1.3) {
                        const died = enemy.takeDamage(proj.damage);
                        proj.destroy();
                        if (died) {
                            this.registerKill(enemy);
                        }
                        break;
                    }
                }
            }
        }

        // 7. Raycast detection for slot hover highlighting
        this.handleRaycast();
    }

    spawnEnemy() {
        let enemy;
        
        if (this.wave === 4 && this.bossActive && !this.enemies.some(e => e.type === 'dragon')) {
            enemy = new BossDragon(this.scene);
        } else {
            const roll = Math.random();
            if (roll < 0.4) {
                enemy = new ZombieFast(this.scene);
            } else if (roll < 0.65) {
                enemy = new ZombieShooter(this.scene);
            } else if (roll < 0.8 || this.wave < 2) {
                enemy = new ZombieTank(this.scene);
            } else {
                enemy = new ZombieMage(this.scene);
            }
        }

        const angle = Math.random() * Math.PI * 2;
        const spawnRadius = 32;
        enemy.mesh.position.set(
            this.castle.position.x + Math.cos(angle) * spawnRadius,
            0,
            this.castle.position.z + Math.sin(angle) * spawnRadius
        );

        this.enemies.push(enemy);
    }

    handleRaycast() {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.castle.slotMeshes);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const slotId = hitMesh.userData.slotId;
            const slot = this.castle.slots.find(s => s.id === slotId);

            if (slot && !slot.defender) {
                if (this.hoveredSlotMesh && this.hoveredSlotMesh !== hitMesh) {
                    this.hoveredSlotMesh.material.emissive.setHex(0x000000);
                }
                this.hoveredSlotMesh = hitMesh;
                this.hoveredSlotMesh.material.emissive.setHex(0x333333);
            }
        } else {
            if (this.hoveredSlotMesh) {
                this.hoveredSlotMesh.material.emissive.setHex(0x000000);
                this.hoveredSlotMesh = null;
            }
        }
    }

    updateEnvironment(deltaTime) {
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');

        this.cacti.forEach(cactus => {
            cactus.rotation.set(0, euler.y, 0); // Billboard to face camera vertically

            const distanceZ = cactus.position.z - this.castle.position.z;
            const distanceX = cactus.position.x - this.castle.position.x;

            // Wrap trees around the castle dynamically to maintain infinite desert vegetation, 
            // but keep them completely stationary in world space when castle is not moving.
            if (distanceZ > 65) {
                // Wrap to front of castle (moving forward makes trees fall behind, wrap them ahead)
                cactus.position.z = this.castle.position.z - 75 - Math.random() * 10;
                cactus.position.x = this.castle.position.x + (Math.random() - 0.5) * 120;
            } else if (distanceZ < -80) {
                // Wrap to back of castle
                cactus.position.z = this.castle.position.z + 55 + Math.random() * 10;
                cactus.position.x = this.castle.position.x + (Math.random() - 0.5) * 120;
            }

            if (Math.abs(distanceX) > 80) {
                cactus.position.x = this.castle.position.x - Math.sign(distanceX) * 75;
            }
        });
    }

    registerKill(enemy) {
        this.totalKills++;
        this.gold += enemy.goldReward;
        this.score += enemy.goldReward * 2;
        this.updateHUD();
    }

    spawnExplosionEffect(position, scale = 1.5) {
        const loader = new THREE.TextureLoader();
        const explodeTex = window.loadGameTexture(loader, 'assets/projectile/explosion.png');
        const explodeGeom = new THREE.PlaneGeometry(1.0, 1.0);
        const explodeMat = new THREE.MeshBasicMaterial({ 
            map: explodeTex, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const blast = new THREE.Mesh(explodeGeom, explodeMat);
        blast.position.copy(position);
        this.scene.add(blast);

        let startTime = Date.now();
        const anim = () => {
            const t = (Date.now() - startTime) / 300;
            if (t < 1) {
                const s = t * scale * 3.0;
                blast.scale.set(s, s, s);
                blast.material.opacity = 0.9 * (1 - t);
                blast.quaternion.copy(this.camera.quaternion);
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(blast);
                explodeGeom.dispose();
                explodeMat.dispose();
            }
        };
        anim();
    }

    triggerWeatherMagic() {
        if (this.totalKills < 100 || this.gameOver || !this.gameStarted) return;
        this.totalKills -= 100;
        this.updateHUD();

        const loader = new THREE.TextureLoader();
        
        // Find all active enemies (excluding BossDragon)
        this.enemies.forEach(enemy => {
            if (!enemy.active || enemy.type === 'dragon') return;

            const startPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 10, 0));
            const endPos = enemy.mesh.position.clone();

            const boltTex = window.loadGameTexture(loader, 'assets/projectile/bolt.png');
            const boltGeom = new THREE.PlaneGeometry(0.8, 3.0);
            const boltMat = new THREE.MeshBasicMaterial({
                map: boltTex,
                transparent: true,
                side: THREE.DoubleSide
            });
            const boltMesh = new THREE.Mesh(boltGeom, boltMat);
            boltMesh.position.copy(startPos);
            this.scene.add(boltMesh);

            let strikeStart = Date.now();
            const strikeAnim = () => {
                const t = (Date.now() - strikeStart) / 200; // 200ms strike speed
                if (t < 1) {
                    boltMesh.position.y = startPos.y - (startPos.y - endPos.y) * t;
                    boltMesh.rotation.z = Math.sin(t * Math.PI) * 0.2;
                    boltMesh.quaternion.copy(this.camera.quaternion);
                    requestAnimationFrame(strikeAnim);
                } else {
                    this.scene.remove(boltMesh);
                    boltGeom.dispose();
                    boltMat.dispose();

                    // Apply massive lightning damage
                    const died = enemy.takeDamage(100);
                    if (died) {
                        this.registerKill(enemy);
                    }
                    
                    // Spawn visual impact blast
                    this.spawnExplosionEffect(endPos, 1.2);
                }
            };
            strikeAnim();
        });
    }

    triggerEarthquake() {
        this.castleFrozenTimer = 5.0;
        this.cameraShakeTimer = 5.0;

        // Sinks castle immediately
        this.castle.mesh.position.y = -0.4;

        // Display yellow warning HUD text overlay
        const warningDiv = document.createElement('div');
        warningDiv.id = 'earthquake-warning';
        warningDiv.innerText = "⚠️ 地震來襲！移動城堡陷落沙中，癱瘓 5 秒！";
        warningDiv.style.cssText = "position:absolute; top:120px; left:50%; transform:translateX(-50%); color:#ffcc00; font-size:1.8rem; font-weight:800; z-index:99; background:rgba(0,0,0,0.85); padding:15px 40px; border-radius:12px; border:3px solid #ffcc00; text-shadow: 0 0 10px rgba(255,204,0,0.5);";
        document.body.appendChild(warningDiv);
        setTimeout(() => warningDiv.remove(), 5000);
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        const btn = document.getElementById('music-btn');
        if (this.musicEnabled) {
            this.bgMusic.play().catch(err => console.log("Music play blocked:", err));
            if (btn) btn.innerText = "🔊 音樂: 開";
        } else {
            this.bgMusic.pause();
            if (btn) btn.innerText = "🔇 音樂: 關";
        }
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    const game = new GameController();
    window.game = game;
    game.init();

    // Hook buttons
    document.getElementById('start-btn').addEventListener('click', () => game.startNewGame());
    document.getElementById('restart-btn').addEventListener('click', () => game.startNewGame());
    
    // Defenders shop hooks
    document.getElementById('buy-archer-btn').addEventListener('click', () => game.selectShopItem('archer'));
    document.getElementById('buy-axeman-btn').addEventListener('click', () => game.selectShopItem('axeman'));
    document.getElementById('buy-crossbow-btn').addEventListener('click', () => game.selectShopItem('crossbow'));
    document.getElementById('buy-bomber-btn').addEventListener('click', () => game.selectShopItem('bomber'));
    
    // Melee Summons hooks
    document.getElementById('spawn-soldier-btn').addEventListener('click', () => game.spawnMeleeAlly('soldier'));
    document.getElementById('spawn-general-btn').addEventListener('click', () => game.spawnMeleeAlly('general'));
    document.getElementById('spawn-princess-btn').addEventListener('click', () => game.spawnMeleeAlly('princess'));
    
    // Repair hook
    document.getElementById('repair-castle-btn').addEventListener('click', () => game.selectShopItem('repair'));

    // Weather magic hook
    document.getElementById('weather-magic-btn').addEventListener('click', () => game.triggerWeatherMagic());

    // Music control hook
    document.getElementById('music-btn').addEventListener('click', () => game.toggleMusic());
});
