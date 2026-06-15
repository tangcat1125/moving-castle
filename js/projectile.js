class Projectile {
    constructor(scene, startPos, targetPos, type = 'bullet', damage = 10) {
        this.scene = scene;
        this.type = type;
        this.damage = damage;
        this.active = true;
        
        // Define speeds
        if (type === 'bone') this.speed = 8;
        else if (type === 'arrow') this.speed = 22;
        else if (type === 'axe') this.speed = 14;
        else if (type === 'bolt') this.speed = 30; // very fast bolt
        else if (type === 'bomb') this.speed = 10;  // heavy bomb toss
        else if (type === 'magic_bolt') this.speed = 16;
        else this.speed = 20;

        // Target tracking
        this.targetPos = targetPos.clone();
        
        // Spawn mesh
        this.mesh = this.createMesh();
        this.mesh.position.copy(startPos);
        this.scene.add(this.mesh);

        // Movement direction
        this.dir = new THREE.Vector3().subVectors(this.targetPos, startPos);
        this.dir.y = 0; // Move horizontally
        this.dir.normalize();
        
        // For parabolic bone/axe/bomb arc
        this.startY = startPos.y;
        this.distance = startPos.distanceTo(new THREE.Vector3(targetPos.x, startPos.y, targetPos.z));
        this.movedDistance = 0;
    }

    createMesh() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();
        
        // Handle fallback in case of unknown type
        const typeName = ['arrow', 'axe', 'bolt', 'bomb', 'bone', 'fireball', 'magic_bolt'].includes(this.type) ? this.type : 'arrow';
        const texture = window.loadGameTexture(loader, `assets/projectile/${typeName}.png`);
        texture.minFilter = THREE.LinearFilter;
        
        const mat = new THREE.MeshPhongMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, // Clean shadows
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        let size = 0.5;
        if (this.type === 'bolt') size = 0.4;
        else if (this.type === 'magic_bolt') size = 0.45;
        else if (this.type === 'fireball') size = 0.6;
        
        const geom = new THREE.PlaneGeometry(size, size);
        const card = new THREE.Mesh(geom, mat);
        card.castShadow = true;
        card.receiveShadow = true;
        
        this.cardMesh = card; // Save reference for billboarding / rotation
        group.add(card);
        
        return group;
    }

    update(deltaTime) {
        if (!this.active) return;

        const moveAmt = this.speed * deltaTime;
        this.movedDistance += moveAmt;
        
        // Move horizontal
        this.mesh.position.addScaledVector(this.dir, moveAmt);
        
        // Parabolic trajectory handling
        if (this.type === 'bone' || this.type === 'axe' || this.type === 'bomb') {
            const progress = Math.min(this.movedDistance / this.distance, 1);
            const peak = this.type === 'bone' ? 3.0 : 1.8;
            const currentHeight = this.startY + Math.sin(progress * Math.PI) * peak;
            this.mesh.position.y = currentHeight;
        }

        // Camera billboarding: orient projectile group to face camera directly
        if (window.game && window.game.camera) {
            this.mesh.quaternion.copy(window.game.camera.quaternion);
            
            // Local rotation relative to billboard plane
            if (['axe', 'bone', 'bomb'].includes(this.type)) {
                // Spin in 2D on the screen
                if (this.spinAngle === undefined) this.spinAngle = 0;
                this.spinAngle += 10 * deltaTime;
                this.cardMesh.rotation.z = this.spinAngle;
            } else {
                // Align direction in screen space
                const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(window.game.camera.quaternion);
                const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(window.game.camera.quaternion);
                
                const screenX = this.dir.dot(camRight);
                const screenY = this.dir.dot(camUp);
                this.cardMesh.rotation.z = Math.atan2(screenY, screenX);
            }
        }

        // Deactivate if reached destination or traveled too far
        if (this.movedDistance >= this.distance) {
            if (this.type === 'bomb') {
                this.explode();
            } else {
                this.destroy();
            }
        }
    }

    explode() {
        this.active = false;
        
        // Spawn visual explosion effect (expanding 2D cartoon blast card)
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
        blast.position.copy(this.mesh.position);
        this.scene.add(blast);

        // Animate blast expansion and fade out
        let startTime = Date.now();
        const anim = () => {
            const t = (Date.now() - startTime) / 350; // 350ms explosion animation
            if (t < 1) {
                const size = t * 4.5; // max size 4.5 units
                blast.scale.set(size, size, size);
                blast.material.opacity = 0.9 * (1 - t);
                // Keep billboarding to face camera
                if (window.game && window.game.camera) {
                    blast.quaternion.copy(window.game.camera.quaternion);
                }
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(blast);
                explodeGeom.dispose();
                explodeMat.dispose();
            }
        };
        anim();

        // Apply AoE Damage
        const blastRadius = 3.5;
        if (window.game) {
            window.game.applyAoEDamage(this.mesh.position, blastRadius, this.damage);
        }
        
        this.destroy();
    }

    destroy() {
        this.active = false;
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}

window.Projectile = Projectile;
