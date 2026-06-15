class Castle {
    constructor(scene) {
        this.scene = scene;
        this.health = 500;
        this.maxHealth = 500;
        this.position = new THREE.Vector3(0, 0, 0);
        
        // Define placement slots for defenders relative to the castle center
        // Repositioned to be clearly on the side decks (outside the keep at x=±1.4) or on top of watchtower (y=3.15)
        this.slots = [
            { id: 0, position: new THREE.Vector3(-1.4, 0.85, -1.0), defender: null, name: "左前甲板" },
            { id: 1, position: new THREE.Vector3(1.4, 0.85, -1.0), defender: null, name: "右前甲板" },
            { id: 2, position: new THREE.Vector3(-1.4, 0.85, 1.2), defender: null, name: "左後砲台" },
            { id: 3, position: new THREE.Vector3(1.4, 0.85, 1.2), defender: null, name: "右後砲台" },
            { id: 4, position: new THREE.Vector3(0, 3.15, 0.3), defender: null, name: "主塔頂層" }
        ];

        this.mesh = this.createModel();
        this.scene.add(this.mesh);

        // Add Floating 3D Health Bar
        this.healthBar = this.createHealthBar();
        this.mesh.add(this.healthBar);
        this.updateHealthBar();
    }

    createModel() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();

        // 1. Base Platform (Chassis) - Box styled with cardboard box texture
        const chassisTex = window.loadGameTexture(loader, 'assets/castle/chassis.png');
        chassisTex.wrapS = THREE.RepeatWrapping;
        chassisTex.wrapT = THREE.RepeatWrapping;
        chassisTex.repeat.set(2, 2);
        
        const chassisMat = new THREE.MeshPhongMaterial({ 
            map: chassisTex, 
            shininess: 10 
        });
        
        const baseGeom = new THREE.BoxGeometry(3.6, 0.6, 4.2);
        const base = new THREE.Mesh(baseGeom, chassisMat);
        base.position.y = 0.5;
        group.add(base);

        // 2. 2D Cardboard Castle Cutout
        const castleTex = window.loadGameTexture(loader, 'assets/castle/castle.png');
        castleTex.minFilter = THREE.LinearFilter;
        
        const castleCardMat = new THREE.MeshPhongMaterial({
            map: castleTex,
            transparent: true,
            alphaTest: 0.1, // clean shadow mask
            side: THREE.DoubleSide,
            shininess: 15
        });
        
        const castleCardGeom = new THREE.PlaneGeometry(3.8, 3.8);
        castleCardGeom.translate(0, 1.9, 0); // Pivot at bottom center
        const castleCard = new THREE.Mesh(castleCardGeom, castleCardMat);
        castleCard.position.set(0, 0.8, 0.2); // Sits on top of chassis base Y=0.8
        group.add(castleCard);

        // 3. Wheels / Moving Treads (6 flat 2D wheels parallel to sides)
        this.wheels = [];
        const wheelTex = window.loadGameTexture(loader, 'assets/castle/wheel.png');
        wheelTex.minFilter = THREE.LinearFilter;
        
        const wheelMat = new THREE.MeshPhongMaterial({
            map: wheelTex,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        const wheelGeom = new THREE.PlaneGeometry(1.0, 1.0);
        
        const wheelCoords = [
            [-1.82, 0.5, -1.5, -Math.PI / 2], [-1.82, 0.5, 0, -Math.PI / 2], [-1.82, 0.5, 1.5, -Math.PI / 2], // Left side
            [1.82, 0.5, -1.5, Math.PI / 2], [1.82, 0.5, 0, Math.PI / 2], [1.82, 0.5, 1.5, Math.PI / 2]    // Right side
        ];

        for (let coords of wheelCoords) {
            const wheel = new THREE.Mesh(wheelGeom, wheelMat);
            wheel.position.set(coords[0], coords[1], coords[2]);
            wheel.rotation.y = coords[3];
            group.add(wheel);
            this.wheels.push(wheel);
        }

        // 4. Build Defender slot platforms (Flat circular cardboard card indicators)
        const slotTex = window.loadGameTexture(loader, 'assets/castle/slot.png');
        slotTex.minFilter = THREE.LinearFilter;
        
        const slotMat = new THREE.MeshPhongMaterial({
            map: slotTex,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            shininess: 10
        });
        
        const slotGeom = new THREE.PlaneGeometry(1.1, 1.1);
        
        this.slotMeshes = [];
        this.slots.forEach(slot => {
            const plat = new THREE.Mesh(slotGeom, slotMat);
            plat.position.copy(slot.position);
            plat.position.y += 0.01; // Place slightly above the chassis top surface
            plat.rotation.x = -Math.PI / 2; // Lie flat on deck
            plat.userData = { slotId: slot.id };
            group.add(plat);
            this.slotMeshes.push(plat);
        });

        // Set shadows
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    }

    createHealthBar() {
        const barGroup = new THREE.Group();
        barGroup.position.set(0, 4.4, 0.3); // position above watchtower cone roof

        const redGeom = new THREE.PlaneGeometry(2.0, 0.15);
        const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const redBar = new THREE.Mesh(redGeom, redMat);
        redBar.position.z = -0.01;
        barGroup.add(redBar);

        const greenGeom = new THREE.PlaneGeometry(2.0, 0.15);
        const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const greenBar = new THREE.Mesh(greenGeom, greenMat);
        barGroup.add(greenBar);

        this.greenBarMesh = greenBar;
        this.healthBarWidth = 2.0;

        // Add HP text mesh
        const hpTextGeom = new THREE.PlaneGeometry(1.6, 0.4);
        const hpTextMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
        const hpTextMesh = new THREE.Mesh(hpTextGeom, hpTextMat);
        hpTextMesh.position.set(0, 0.35, 0.01);
        barGroup.add(hpTextMesh);
        this.hpTextMesh = hpTextMesh;

        return barGroup;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        // Minor camera shake or color flash can be triggered by game controller
        if (this.health <= 0) {
            return true; // Game Over
        }
        return false;
    }

    repair(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateHealthBar();
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

    update(deltaTime) {
        // 1. Make wheels spin to simulate desert driving
        const rollSpeed = 4.0; // speed of driving animation
        this.wheels.forEach(wheel => {
            // Since they are rotated around Y by ±PI/2, they roll by rotating around local Z axis
            const isLeft = wheel.position.x < 0;
            const dirMultiplier = isLeft ? 1 : -1;
            wheel.rotation.z += dirMultiplier * rollSpeed * deltaTime;
        });

        // 2. Minor engine bobbing / hover effect
        if (window.game && window.game.castleFrozenTimer > 0) {
            this.mesh.position.y = -0.4; // Sunk slightly in the sand
        } else {
            const t = Date.now() * 0.005;
            this.mesh.position.y = Math.sin(t) * 0.04;
        }
    }
}

window.Castle = Castle;
