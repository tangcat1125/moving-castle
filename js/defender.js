class Defender {
    constructor(scene, slotPosition, relativePos, parentCastleMesh, type = 'archer') {
        this.scene = scene;
        this.relativePos = relativePos; // Position relative to castle mesh
        this.parentCastleMesh = parentCastleMesh;
        this.type = type;
        this.active = true;
        this.lastShootTime = 0;
        this.health = 80;
        this.maxHealth = 80;

        // Custom stats per defender type
        if (type === 'archer') {
            this.range = 14;
            this.shootCooldown = 1200; // ms
            this.damage = 12;
            this.projectileType = 'arrow';
        } else if (type === 'axeman') {
            this.range = 9;
            this.shootCooldown = 2000; // ms
            this.damage = 28;
            this.projectileType = 'axe';
        } else if (type === 'crossbow') {
            this.range = 11;
            this.shootCooldown = 450; // ms
            this.damage = 6;
            this.projectileType = 'bolt';
        } else if (type === 'bomber') {
            this.range = 10;
            this.shootCooldown = 2500; // ms
            this.damage = 35; // AoE Explosion Damage
            this.projectileType = 'bomb';
        }

        // Visual model
        this.mesh = this.createModel();
        this.mesh.position.copy(relativePos);
        this.parentCastleMesh.add(this.mesh); // Attach directly to castle to move with it

        // Add Floating 3D Health Bar
        this.healthBarWidth = 0.8;
        this.healthBar = this.createHealthBar();
        this.mesh.add(this.healthBar);
        this.updateHealthBar();
    }

    createModel() {
        const group = new THREE.Group();
        
        // Load the correct texture for the defender type
        const loader = new THREE.TextureLoader();
        const texture = window.loadGameTexture(loader, `assets/defender/${this.type}.png`);
        texture.minFilter = THREE.LinearFilter;
        
        const mat = new THREE.MeshPhongMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, // Clean shadows
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        // Height of card is 1.2, width is 1.2
        const geom = new THREE.PlaneGeometry(1.2, 1.2);
        geom.translate(0, 0.6, 0); // Origin at bottom center
        
        const card = new THREE.Mesh(geom, mat);
        card.castShadow = true;
        card.receiveShadow = true;
        group.add(card);
        
        return group;
    }

    createHealthBar() {
        const barGroup = new THREE.Group();
        barGroup.position.set(0, 1.4, 0); // Position above character head

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
        const hpTextGeom = new THREE.PlaneGeometry(0.8, 0.2);
        const hpTextMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
        const hpTextMesh = new THREE.Mesh(hpTextGeom, hpTextMat);
        hpTextMesh.position.set(0, 0.16, 0.01);
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
            this.destroy();
            return true; // Died
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

    update(enemies, game) {
        if (!this.active) return;

        // Ensure parent and self matrices are fully computed for accurate world coordinate lookups
        this.mesh.updateMatrixWorld(true);

        // Billboarding: orient healthbar to camera
        if (this.healthBar) {
            this.healthBar.quaternion.copy(game.camera.quaternion);
        }

        // Find world position of defender
        const worldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPos);

        // Find nearest target in range
        let nearestEnemy = null;
        let minDist = this.range;

        for (let enemy of enemies) {
            if (!enemy.active) continue;
            const dist = worldPos.distanceTo(enemy.mesh.position);
            if (dist < minDist) {
                minDist = dist;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            // Face target relative to the castle's orientation
            const targetDir = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, worldPos);
            targetDir.y = 0;
            targetDir.normalize();

            // Convert direction to local space of the parent castle
            const localDir = targetDir.clone();
            localDir.applyQuaternion(this.parentCastleMesh.quaternion.clone().invert());

            const localAngle = Math.atan2(localDir.x, localDir.z);
            this.mesh.rotation.y = localAngle;

            // Attack
            const now = Date.now();
            if (now - this.lastShootTime > this.shootCooldown) {
                this.lastShootTime = now;
                
                // Shoot respective projectile
                const spawnPos = worldPos.clone().add(new THREE.Vector3(0, 0.6, 0.2));
                game.spawnProjectile(spawnPos, nearestEnemy.mesh.position, this.projectileType, this.damage);
            }
        } else {
            // Idle orientation (looking outward or forward)
            this.mesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.2;
        }
    }

    destroy() {
        this.active = false;
        if (this.parentCastleMesh && this.mesh) {
            this.parentCastleMesh.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

window.Defender = Defender;
