class Enemy {
    constructor(scene, type = 'fast') {
        this.scene = scene;
        this.type = type;
        this.active = true;
        this.spawnTime = Date.now();
        this.isMergedGiant = false;
        this.scaleMult = 1.0;
        
        // Define stats based on type
        if (type === 'fast') {
            this.health = 20;
            this.maxHealth = 20;
            this.speed = 3.5;
            this.goldReward = 15;
            this.damage = 5;
            this.color = 0x2e8b57; // SeaGreen
        } else if (type === 'tank') {
            this.health = 100;
            this.maxHealth = 100;
            this.speed = 1.2;
            this.goldReward = 50;
            this.damage = 20;
            this.color = 0x145a32; // Dark Forest Green
        } else if (type === 'shooter') {
            this.health = 35;
            this.maxHealth = 35;
            this.speed = 1.8;
            this.goldReward = 30;
            this.damage = 8;
            this.color = 0x6c3483; // Purple Caped
            this.lastShootTime = 0;
            this.shootCooldown = 2500; // ms
            this.shootRange = 12;
        } else if (type === 'dragon') {
            this.health = 600;
            this.maxHealth = 600;
            this.speed = 1.0;
            this.goldReward = 200;
            this.damage = 30; // heavy damage
            this.color = 0xd35400; // Red-orange dragon scale
            this.lastShootTime = 0;
            this.shootCooldown = 2000;
            this.shootRange = 16;
        } else if (type === 'mage') {
            this.health = 50;
            this.maxHealth = 50;
            this.speed = 1.5;
            this.goldReward = 40;
            this.damage = 10; // melee
            this.magicDamage = 15; // magic ranged
            this.color = 0x9b59b6; // Purple Mage
            this.lastShootTime = 0;
            this.shootCooldown = 2200; // ms
            this.shootRange = 10;
        }

        // Spawn position (outer circle radius ~30 units)
        const angle = Math.random() * Math.PI * 2;
        const radius = 35;
        this.position = new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        );

        this.mesh = this.createModel();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Add 3D Health Bar
        this.healthBar = this.createHealthBar();
        this.mesh.add(this.healthBar);
        this.updateHealthBar();
    }

    createModel() {
        const group = new THREE.Group();
        
        // Load the correct texture for the enemy type
        const loader = new THREE.TextureLoader();
        const texName = this.type === 'dragon' ? 'dragon' : `zombie_${this.type}`;
        const texture = window.loadGameTexture(loader, `assets/enemy/${texName}.png`);
        texture.minFilter = THREE.LinearFilter;
        
        const mat = new THREE.MeshPhongMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, // Clean shadows
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        let scale = this.type === 'dragon' ? 3.2 : (this.type === 'tank' ? 1.7 : (this.type === 'shooter' ? 1.2 : (this.type === 'mage' ? 1.25 : 1.0)));
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
        let scale = this.type === 'dragon' ? 2.2 : (this.type === 'tank' ? 1.6 : (this.type === 'fast' ? 0.9 : 1.1));
        barGroup.position.set(0, 1.8 * scale, 0); // Position above character head

        const redGeom = new THREE.PlaneGeometry(1.0, 0.08);
        const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const redBar = new THREE.Mesh(redGeom, redMat);
        redBar.position.z = -0.01;
        barGroup.add(redBar);

        const greenGeom = new THREE.PlaneGeometry(1.0, 0.08);
        const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const greenBar = new THREE.Mesh(greenGeom, greenMat);
        barGroup.add(greenBar);

        this.greenBarMesh = greenBar;
        this.healthBarWidth = 1.0;

        // Add HP text mesh
        const hpTextGeom = new THREE.PlaneGeometry(1.0, 0.25);
        const hpTextMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
        const hpTextMesh = new THREE.Mesh(hpTextGeom, hpTextMat);
        hpTextMesh.position.set(0, 0.18, 0.01);
        barGroup.add(hpTextMesh);
        this.hpTextMesh = hpTextMesh;

        return barGroup;
    }

    updateHealthBar() {
        const ratio = Math.max(0, this.health / this.maxHealth);
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

    takeDamage(amount) {
        this.health -= amount;
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
            return true; // Died
        }
        return false;
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

    update(deltaTime, castlePos, game) {
        if (!this.active) return;

        // Billboarding: orient enemy to face the camera vertically
        const euler = new THREE.Euler().setFromQuaternion(game.camera.quaternion, 'YXZ');
        this.mesh.rotation.set(0, euler.y, 0);

        // Dragon Boss specific paper wobble & bobbing animation
        if (this.type === 'dragon' && this.cardMesh) {
            this.cardMesh.rotation.z = Math.sin(Date.now() * 0.008) * 0.06;
            this.cardMesh.position.y = Math.sin(Date.now() * 0.005) * 0.12;

            // Earthquake trigger check
            if (this.earthquakeCooldown === undefined) this.earthquakeCooldown = 0;
            if (this.earthquakeCooldown > 0) {
                this.earthquakeCooldown -= deltaTime;
            }

            const smallMonsters = game.enemies.filter(e => e.active && e.type !== 'dragon');
            if (smallMonsters.length >= 10 && this.earthquakeCooldown <= 0) {
                this.earthquakeCooldown = 15.0; // 15 seconds cooldown
                game.triggerEarthquake();
            }
        }

        // Orient healthbar to look at camera (billboarding)
        if (this.healthBar) {
            this.healthBar.quaternion.copy(game.camera.quaternion);
        }

        // Move towards target (either nearest Melee Ally, or the Castle)
        let targetPos = castlePos.clone();
        let targetDist = targetPos.distanceTo(this.mesh.position);
        
        // Check if there are melee allies to target instead of the castle
        let nearestAlly = null;
        let minAllyDist = 18;

        for (let ally of game.allies) {
            if (!ally.active) continue;
            const d = this.mesh.position.distanceTo(ally.mesh.position);
            if (d < minAllyDist) {
                minAllyDist = d;
                nearestAlly = ally;
            }
        }

        if (nearestAlly) {
            targetPos = nearestAlly.mesh.position.clone();
            targetDist = minAllyDist;
        }

        const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
        dir.y = 0;
        dir.normalize();

        // Specific Shooter / Boss / Mage behavior
        if ((this.type === 'shooter' || this.type === 'dragon' || this.type === 'mage') && targetDist <= this.shootRange) {
            const now = Date.now();
            if (now - this.lastShootTime > this.shootCooldown) {
                this.lastShootTime = now;
                
                const projType = this.type === 'dragon' ? 'fireball' : (this.type === 'mage' ? 'magic_bolt' : 'bone');
                const spawnHeight = this.type === 'dragon' ? 1.6 : (this.type === 'mage' ? 1.3 : 1.2);
                const spawnPos = this.mesh.position.clone().add(new THREE.Vector3(0, spawnHeight, 0.4));
                
                const dmg = this.type === 'mage' ? this.magicDamage : this.damage;
                game.spawnProjectile(spawnPos, targetPos, projType, dmg);
            }
        } else {
            // Normal walking forward towards the target
            if (targetDist > 1.2 || nearestAlly === null) {
                this.mesh.position.addScaledVector(dir, this.speed * deltaTime);
            } else if (nearestAlly && targetDist <= 1.2) {
                // Melee attack ally
                const now = Date.now();
                if (!this.lastMeleeTime || now - this.lastMeleeTime > 1500) {
                    this.lastMeleeTime = now;
                    nearestAlly.takeDamage(this.damage / 2);
                }
            }
        }

        // Horizontal Flipping based on motion relative to camera
        if (dir.lengthSq() > 0.01 && this.cardMesh) {
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(game.camera.quaternion);
            camRight.y = 0;
            camRight.normalize();
            
            if (dir.dot(camRight) < 0) {
                this.cardMesh.scale.x = -this.scaleMult; // Face left relative to screen
            } else {
                this.cardMesh.scale.x = this.scaleMult;  // Face right relative to screen
            }
        }
    }
}

class ZombieFast extends Enemy { constructor(scene) { super(scene, 'fast'); } }
class ZombieTank extends Enemy { constructor(scene) { super(scene, 'tank'); } }
class ZombieShooter extends Enemy { constructor(scene) { super(scene, 'shooter'); } }
class ZombieMage extends Enemy { constructor(scene) { super(scene, 'mage'); } }
class BossDragon extends Enemy {
    constructor(scene, waveNum = 1) {
        super(scene, 'dragon');
        this.waveNum = waveNum;

        // Base scale for Wave 1 is 1.0 (mesh scale is 3.2, health is 600, speed is 1.0)
        // Wave 2 is 1.5x scale (health is 1000, speed 1.1, damage 45)
        // Wave 3 is 2.0x scale (health is 1500, speed 1.2, damage 60)
        let scaleMult = 1.0;
        if (waveNum === 2) {
            this.health = 1000;
            this.maxHealth = 1000;
            this.speed = 1.1;
            this.damage = 45;
            this.shootRange = 18;
            this.goldReward = 300;
            scaleMult = 1.5;
        } else if (waveNum === 3) {
            this.health = 1500;
            this.maxHealth = 1500;
            this.speed = 1.2;
            this.damage = 60;
            this.shootRange = 20;
            this.goldReward = 500;
            scaleMult = 2.0;
        }

        this.scaleMult = scaleMult;

        // Apply scale multipliers
        if (this.cardMesh) {
            this.cardMesh.scale.set(scaleMult, scaleMult, 1);
        }
        if (this.healthBar) {
            // Reposition health bar based on new height
            const baseScale = 2.2;
            this.healthBar.position.y = 1.8 * baseScale * scaleMult;
        }
        
        this.updateHealthBar();
    }
}

window.Enemy = Enemy;
window.ZombieFast = ZombieFast;
window.ZombieTank = ZombieTank;
window.ZombieShooter = ZombieShooter;
window.ZombieMage = ZombieMage;
window.BossDragon = BossDragon;
