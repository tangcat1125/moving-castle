class Ally {
    constructor(scene, startPos, type = 'soldier') {
        this.scene = scene;
        this.type = type;
        this.active = true;
        this.spawnTime = Date.now();
        
        // Attack counting for Ultimates
        this.attackCount = 0;
        this.lastAttackTime = 0;

        if (type === 'soldier') {
            this.health = 50;
            this.maxHealth = 50;
            this.speed = 3.2;
            this.damage = 10;
            this.cooldown = 1000; // 1s
            this.range = 1.3;
            this.color = 0x5dade2; // Light blue
        } else if (type === 'general') {
            this.health = 220; // tankier
            this.maxHealth = 220;
            this.speed = 2.2;
            this.damage = 35; // high damage
            this.cooldown = 1800; // slower attack speed
            this.range = 1.6;
            this.color = 0xc0392b; // Dark Red
        } else if (type === 'princess') {
            this.health = 400;
            this.maxHealth = 400;
            this.speed = 5.0; // agile
            this.damage = 10;
            this.cooldown = 300; // VERY FAST attack speed
            this.range = 1.8;
            this.color = 0xff69b4; // Hot Pink
        }

        // Spawn slightly offset from castle gate
        this.position = startPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 0, 2.0));
        
        // 3D Model
        this.mesh = this.createModel();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Add 3D Health Bar
        this.healthBarWidth = 1.0;
        this.healthBar = this.createHealthBar();
        this.mesh.add(this.healthBar);
        this.updateHealthBar();
    }

    createModel() {
        const group = new THREE.Group();
        
        // Load the correct texture for the ally type
        const loader = new THREE.TextureLoader();
        const texture = window.loadGameTexture(loader, `assets/ally/${this.type}.png`);
        texture.minFilter = THREE.LinearFilter;
        
        const mat = new THREE.MeshPhongMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, // Clean shadows
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        let scale = this.type === 'general' ? 1.5 : (this.type === 'princess' ? 1.25 : 1.1);
        const geom = new THREE.PlaneGeometry(scale, scale);
        geom.translate(0, scale / 2, 0); // Origin at bottom center
        
        const card = new THREE.Mesh(geom, mat);
        card.castShadow = true;
        card.receiveShadow = true;
        
        this.cardMesh = card; // Save reference for horizontal flipping
        group.add(card);
        
        return group;
    }

    createHealthBar() {
        const barGroup = new THREE.Group();
        barGroup.position.set(0, 1.7, 0); // Position above character head

        const redGeom = new THREE.PlaneGeometry(this.healthBarWidth, 0.08);
        const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const redBar = new THREE.Mesh(redGeom, redMat);
        redBar.position.z = -0.01;
        barGroup.add(redBar);

        const greenGeom = new THREE.PlaneGeometry(this.healthBarWidth, 0.08);
        const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const greenBar = new THREE.Mesh(greenGeom, greenMat);
        barGroup.add(greenBar);

        this.greenBarMesh = greenBar;

        // Add HP text mesh
        const hpTextGeom = new THREE.PlaneGeometry(1.0, 0.25);
        const hpTextMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
        const hpTextMesh = new THREE.Mesh(hpTextGeom, hpTextMat);
        hpTextMesh.position.set(0, 0.18, 0.01);
        barGroup.add(hpTextMesh);
        this.hpTextMesh = hpTextMesh;

        return barGroup;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();

        // Flash red visual effect
        this.mesh.traverse(child => {
            if (child.material && child.material.color && child !== this.greenBarMesh) {
                const origColor = child.material.color.getHex();
                child.material.color.setHex(0xff0000);
                setTimeout(() => {
                    if (this.active && child.material) {
                        child.material.color.setHex(origColor);
                    }
                }, 100);
            }
        });

        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    updateHealthBar() {
        const ratio = this.health / this.maxHealth;
        if (this.greenBarMesh) {
            this.greenBarMesh.scale.x = ratio;
            this.greenBarMesh.position.x = -(1 - ratio) * (this.healthBarWidth / 2);
        }
        if (this.hpTextMesh) {
            if (this.hpTextMesh.material.map) {
                this.hpTextMesh.material.map.dispose();
            }
            this.hpTextMesh.material.map = window.createHPTextTexture(this.health, this.maxHealth);
            this.hpTextMesh.material.needsUpdate = true;
        }
    }

    die() {
        this.active = false;
        this.destroy();
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }

    triggerFlameSword(dir, game) {
        // Ultimate: Fire sword dash and straight line slash
        const swordLen = 12.0;
        const swordWidth = 2.0;

        // Draw 2D card of assets/ally/fire_sword.png lying flat
        const loader = new THREE.TextureLoader();
        const swordTex = window.loadGameTexture(loader, 'assets/ally/fire_sword.png');
        swordTex.minFilter = THREE.LinearFilter;
        const slashMat = new THREE.MeshBasicMaterial({
            map: swordTex,
            transparent: true,
            alphaTest: 0.05,
            side: THREE.DoubleSide
        });
        const slashGeom = new THREE.PlaneGeometry(swordWidth, swordLen);
        slashGeom.rotateX(-Math.PI / 2); // lie flat
        slashGeom.translate(0, 0.05, swordLen / 2); // pivot near Princess, extends forward
        
        const slash = new THREE.Mesh(slashGeom, slashMat);
        const angle = this.mesh.rotation.y;
        slash.position.copy(this.mesh.position);
        slash.rotation.y = angle;
        this.scene.add(slash);

        // Flame Sword Dash
        const dashTarget = this.mesh.position.clone().add(new THREE.Vector3(Math.sin(angle) * (swordLen - 2), 0, Math.cos(angle) * (swordLen - 2)));
        this.mesh.position.copy(dashTarget);

        // Animate strike fading
        let start = Date.now();
        const anim = () => {
            const t = (Date.now() - start) / 300;
            if (t < 1) {
                slashMat.opacity = 1.0 * (1 - t);
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(slash);
                slashGeom.dispose();
                slashMat.dispose();
                swordTex.dispose();
            }
        };
        anim();

        // Damage all enemies in linear range
        game.enemies.forEach(enemy => {
            if (enemy.active) {
                // Vector projection to verify straight line hit
                const diff = new THREE.Vector3().subVectors(enemy.mesh.position, this.mesh.position);
                diff.y = 0;
                
                // Project on forward vector
                const forwardVec = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
                const projectionLen = diff.dot(forwardVec);
                const perpendicularDist = Math.sqrt(diff.lengthSq() - projectionLen ** 2);

                if (projectionLen > -3 && projectionLen < swordLen + 2 && perpendicularDist < (swordWidth / 2) + 0.8) {
                    const died = enemy.takeDamage(150); // Massive ultimate slash
                    if (died) {
                        game.registerKill(enemy);
                    }
                }
            }
        });
    }

    triggerEarthSlam(targetEnemy, game) {
        // Ultimate: Earth slam grabbing target zombie and instantly killing or heavily damaging surrounding zombies
        const slamPos = targetEnemy.mesh.position.clone();
        
        // Seismic Toss Visual: expanding earth ring
        const ringGeom = new THREE.RingGeometry(0.1, 4.5, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xd35400, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(slamPos).y = 0.05;
        this.scene.add(ring);

        // Grab target zombie up in the air and slam down
        let start = Date.now();
        const slamAnim = () => {
            const t = (Date.now() - start) / 400; // 400ms quick lift and slam
            if (t < 1) {
                if (targetEnemy.active) {
                    // lift target in sine wave arc
                    targetEnemy.mesh.position.y = Math.sin(t * Math.PI) * 4.0;
                }
                ring.scale.set(t * 1.5, t * 1.5, 1);
                ring.material.opacity = 0.8 * (1 - t);
                requestAnimationFrame(slamAnim);
            } else {
                if (targetEnemy.active) {
                    targetEnemy.mesh.position.y = 0;
                    targetEnemy.takeDamage(150); // Heavy slam damage to target (likely instant death)
                }
                this.scene.remove(ring);
                ringGeom.dispose();
                ringMat.dispose();
            }
        };
        slamAnim();

        // Deal fatal damage to all zombies in the General's slam circle (radius 4.5)
        const radius = 4.5;
        game.enemies.forEach(enemy => {
            if (enemy.active && enemy !== targetEnemy) {
                const dist = Math.sqrt((enemy.mesh.position.x - slamPos.x) ** 2 + (enemy.mesh.position.z - slamPos.z) ** 2);
                if (dist <= radius) {
                    const died = enemy.takeDamage(120); // Near fatal damage to standard enemies
                    if (died) {
                        game.registerKill(enemy);
                    }
                }
            }
        });
    }

    update(deltaTime, enemies, castle, game, camera) {
        if (!this.active) return;

        // Billboarding: orient character to face the camera vertically
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        this.mesh.rotation.set(0, euler.y, 0);

        // Billboarding: orient healthbar to camera
        if (this.healthBar) {
            this.healthBar.quaternion.copy(camera.quaternion);
        }

        // Find nearest leader if we are a soldier
        let leader = null;
        if (this.type === 'soldier') {
            let minLeaderDist = 999;
            for (let other of game.allies) {
                if (other.active && (other.type === 'princess' || other.type === 'general')) {
                    const d = this.mesh.position.distanceTo(other.mesh.position);
                    if (d < minLeaderDist) {
                        minLeaderDist = d;
                        leader = other;
                    }
                }
            }
        }

        // Find nearest enemy to engage
        let nearestEnemy = null;
        if (this.type === 'soldier' && leader && leader.engagedEnemy && leader.engagedEnemy.active) {
            // Priority target: the leader's target
            nearestEnemy = leader.engagedEnemy;
        } else {
            // Standard target: nearest enemy
            let minDist = 30;
            for (let enemy of enemies) {
                if (!enemy.active) continue;
                const dist = this.mesh.position.distanceTo(enemy.mesh.position);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = enemy;
                }
            }
        }

        this.engagedEnemy = nearestEnemy; // Store target for followers

        let currentSpeed = this.speed;
        if (this.type === 'soldier' && leader) {
            const distToLeader = this.mesh.position.distanceTo(leader.mesh.position);
            if (distToLeader > 6.0) {
                currentSpeed = this.speed * 1.5; // Catch up speed boost
            }
        }

        let moveDir = new THREE.Vector3(0, 0, 0);

        if (nearestEnemy) {
            const dir = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, this.mesh.position);
            dir.y = 0;
            const dist = dir.length();
            dir.normalize();

            moveDir.copy(dir);

            if (dist > this.range) {
                // Walk towards enemy
                this.mesh.position.addScaledVector(dir, currentSpeed * deltaTime);
                
                // Bobbing walk animation
                const elapsed = (Date.now() - this.spawnTime) * 0.01;
                this.mesh.position.y = Math.abs(Math.sin(elapsed * currentSpeed)) * 0.15;
            } else {
                // Stand ground and attack
                this.mesh.position.y = 0;
                const now = Date.now();
                if (now - this.lastAttackTime > this.cooldown) {
                    this.lastAttackTime = now;
                    this.attackCount++;
                    
                    // Trigger ultimate logic check
                    if (this.type === 'princess' && this.attackCount >= 10) {
                        this.attackCount = 0;
                        this.triggerFlameSword(dir, game);
                    } else if (this.type === 'general' && this.attackCount >= 5) {
                        this.attackCount = 0;
                        this.triggerEarthSlam(nearestEnemy, game);
                    } else {
                        // Standard attack lunge
                        const originalZ = this.mesh.position.z;
                        const originalX = this.mesh.position.x;
                        this.mesh.position.addScaledVector(dir, 0.4);
                        setTimeout(() => {
                             if (this.active) {
                                 this.mesh.position.set(originalX, this.mesh.position.y, originalZ);
                             }
                        }, 150);

                        // Damage target
                        let finalDamage = this.damage;
                        if (this.type === 'soldier' && leader) {
                            const distToLeader = this.mesh.position.distanceTo(leader.mesh.position);
                            if (distToLeader <= 5.0) {
                                finalDamage = Math.round(this.damage * 1.5); // +50% attack correction!
                            }
                        }
                        const died = nearestEnemy.takeDamage(finalDamage);
                        if (died) {
                            game.registerKill(nearestEnemy);
                        }
                    }
                }
            }
        } else {
            // No enemies: follow leader or follow castle
            let targetPos = null;
            if (this.type === 'soldier' && leader) {
                // Stay close to leader
                targetPos = leader.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, -1.0));
            } else {
                targetPos = castle.position.clone().add(new THREE.Vector3(0, 0, 3)); // stay behind/near castle
            }
            const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
            dir.y = 0;
            const dist = dir.length();
            
            const minFollowDist = (this.type === 'soldier' && leader) ? 2.0 : 3.0;
            if (dist > minFollowDist) {
                dir.normalize();
                moveDir.copy(dir);
                this.mesh.position.addScaledVector(dir, currentSpeed * deltaTime);
                const elapsed = (Date.now() - this.spawnTime) * 0.01;
                this.mesh.position.y = Math.abs(Math.sin(elapsed * currentSpeed)) * 0.15;
            } else {
                this.mesh.position.y = 0;
            }
        }

        // Horizontal Flipping based on motion relative to camera
        if (moveDir.lengthSq() > 0.01 && this.cardMesh) {
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            camRight.y = 0;
            camRight.normalize();
            
            if (moveDir.dot(camRight) < 0) {
                this.cardMesh.scale.x = -1; // Face left relative to screen
            } else {
                this.cardMesh.scale.x = 1;  // Face right relative to screen
            }
        }
    }
}

window.Ally = Ally;
