import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface Food3DGenerationOptions {
  productName: string;
  category?: string;
  photoDataUrls?: string[];
  dishType?: 'plate_meal' | 'burger' | 'pizza' | 'cake' | 'soup' | 'grill' | 'drink' | 'auto';
}

/**
 * Detect best 3D food template geometry based on food name and category
 */
export function detectFoodType(productName: string = '', category: string = ''): 'plate_meal' | 'burger' | 'pizza' | 'cake' | 'soup' | 'grill' | 'drink' {
  const text = `${productName} ${category}`.toLowerCase();

  if (text.includes('burger') || text.includes('sandwich') || text.includes('shawarma')) {
    return 'burger';
  }
  if (text.includes('pizza')) {
    return 'pizza';
  }
  if (text.includes('keki') || text.includes('cake') || text.includes('dessert') || text.includes('donut') || text.includes('pastry') || text.includes('ice cream')) {
    return 'cake';
  }
  if (text.includes('supu') || text.includes('soup') || text.includes('mchuzi') || text.includes('curry') || text.includes('stew') || text.includes('uji')) {
    return 'soup';
  }
  if (text.includes('mishkaki') || text.includes('nyama choma') || text.includes('kuku choma') || text.includes('bbq') || text.includes('grill') || text.includes('seki')) {
    return 'grill';
  }
  if (text.includes('soda') || text.includes('juice') || text.includes('vinywaji') || text.includes('drink') || text.includes('coffee') || text.includes('kahawa') || text.includes('chai') || text.includes('cocktail') || text.includes('water') || text.includes('maji')) {
    return 'drink';
  }

  // Default rich plate meal (Wali, Pilau, Biryani, Chips Kuku, Ugali, Samaki, etc.)
  return 'plate_meal';
}

/**
 * Creates a canvas texture combining vendor photos with food shading
 */
async function createPhotoTexture(photoDataUrl?: string, fallbackColor = '#d97706'): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 256;
    fallbackCanvas.height = 256;
    return new THREE.CanvasTexture(fallbackCanvas);
  }

  if (photoDataUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = photoDataUrl;
      });

      // Draw vendor's food photo with vignette and warm enhancement
      ctx.drawImage(img, 0, 0, 512, 512);

      // Subtle warm food lighting overlay
      const grad = ctx.createRadialGradient(256, 256, 100, 256, 256, 256);
      grad.addColorStop(0, 'rgba(255, 230, 180, 0.15)');
      grad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    } catch {
      // Fall through to procedural texture
    }
  }

  // Procedural appetizing food texture
  ctx.fillStyle = fallbackColor;
  ctx.fillRect(0, 0, 512, 512);

  // Add speckled appetizing noise & grill marks
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 6 + 2;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90, 40, 10, 0.35)' : 'rgba(255, 240, 190, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Builds realistic 3D Food Scene in Three.js
 */
export async function buildFoodScene(options: Food3DGenerationOptions): Promise<THREE.Group> {
  const foodType = options.dishType === 'auto' || !options.dishType 
    ? detectFoodType(options.productName, options.category) 
    : options.dishType;

  const group = new THREE.Group();
  group.name = `Food3D_${foodType}`;

  const primaryPhoto = options.photoDataUrls && options.photoDataUrls.length > 0 
    ? options.photoDataUrls[0] 
    : undefined;

  const photoTexture = await createPhotoTexture(primaryPhoto);

  // Material helpers
  const ceramicMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.15,
    metalness: 0.05,
  });

  const goldRimMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.3,
    metalness: 0.8,
  });

  const woodenMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d2e,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Food surface material mapping the vendor's dish photo
  const foodTopMat = new THREE.MeshStandardMaterial({
    map: photoTexture,
    roughness: 0.45,
    metalness: 0.1,
  });

  switch (foodType) {
    case 'burger': {
      // 1. Wooden serving board
      const boardGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.1, 32);
      const board = new THREE.Mesh(boardGeo, woodenMat);
      board.position.y = -0.05;
      group.add(board);

      // 2. Bottom Bun
      const botBunGeo = new THREE.CylinderGeometry(1.0, 0.9, 0.3, 32);
      const bunMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
      const botBun = new THREE.Mesh(botBunGeo, bunMat);
      botBun.position.y = 0.15;
      group.add(botBun);

      // 3. Crisp Green Lettuce
      const lettuceGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16);
      const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
      const lettuce = new THREE.Mesh(lettuceGeo, lettuceMat);
      lettuce.position.y = 0.32;
      group.add(lettuce);

      // 4. Juicy Patty (with photo texture mapped)
      const pattyGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.35, 32);
      const patty = new THREE.Mesh(pattyGeo, foodTopMat);
      patty.position.y = 0.52;
      group.add(patty);

      // 5. Melted Cheese Slice
      const cheeseGeo = new THREE.BoxGeometry(1.3, 0.06, 1.3);
      const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.y = 0.72;
      cheese.rotation.y = Math.PI / 4;
      group.add(cheese);

      // 6. Tomato Slice
      const tomatoGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24);
      const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2 });
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.y = 0.82;
      group.add(tomato);

      // 7. Top Dome Bun with Sesame Seeds
      const topBunGeo = new THREE.SphereGeometry(1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const topBun = new THREE.Mesh(topBunGeo, bunMat);
      topBun.position.y = 0.88;
      group.add(topBun);

      // Add crispy french fries on the side
      const fryGeo = new THREE.BoxGeometry(0.12, 0.12, 0.9);
      const fryMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 });
      for (let i = 0; i < 14; i++) {
        const fry = new THREE.Mesh(fryGeo, fryMat);
        const angle = (i / 14) * Math.PI * 2;
        fry.position.set(Math.cos(angle) * 1.25, 0.1 + (i % 3) * 0.05, Math.sin(angle) * 1.25);
        fry.rotation.set(Math.random() * 0.4, angle + Math.random() * 0.5, Math.random() * 0.4);
        group.add(fry);
      }
      break;
    }

    case 'pizza': {
      // 1. Pizza Board / Pan
      const panGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.08, 36);
      const pan = new THREE.Mesh(panGeo, woodenMat);
      pan.position.y = -0.04;
      group.add(pan);

      // 2. Pizza Dough Crust Ring
      const crustGeo = new THREE.TorusGeometry(1.5, 0.16, 16, 36);
      const crustMat = new THREE.MeshStandardMaterial({ color: 0xc27803, roughness: 0.7 });
      const crust = new THREE.Mesh(crustGeo, crustMat);
      crust.rotation.x = Math.PI / 2;
      crust.position.y = 0.1;
      group.add(crust);

      // 3. Cheese Base with Photo Texture
      const baseGeo = new THREE.CylinderGeometry(1.48, 1.48, 0.1, 36);
      const pizzaSurface = new THREE.Mesh(baseGeo, foodTopMat);
      pizzaSurface.position.y = 0.06;
      group.add(pizzaSurface);

      // 4. Pepperoni & Herb Toppings
      const pepGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16);
      const pepMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.3 });
      const basilGeo = new THREE.BoxGeometry(0.18, 0.02, 0.25);
      const basilMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });

      for (let i = 0; i < 9; i++) {
        const rad = 0.4 + (i % 2) * 0.6;
        const ang = (i / 9) * Math.PI * 2;
        const pep = new THREE.Mesh(pepGeo, pepMat);
        pep.position.set(Math.cos(ang) * rad, 0.12, Math.sin(ang) * rad);
        group.add(pep);

        const basil = new THREE.Mesh(basilGeo, basilMat);
        basil.position.set(Math.cos(ang + 0.3) * (rad + 0.2), 0.13, Math.sin(ang + 0.3) * (rad + 0.2));
        basil.rotation.y = Math.random() * Math.PI;
        group.add(basil);
      }
      break;
    }

    case 'cake': {
      // 1. Ceramic Cake Stand Plate
      const standGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32);
      const stand = new THREE.Mesh(standGeo, ceramicMat);
      stand.position.y = -0.05;
      group.add(stand);

      // 2. Gold Rim
      const rimGeo = new THREE.TorusGeometry(1.5, 0.04, 16, 32);
      const rim = new THREE.Mesh(rimGeo, goldRimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.01;
      group.add(rim);

      // 3. Cake Base Layer
      const cakeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 32);
      const cakeBodyMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 }); // chocolate
      const cakeBody = new THREE.Mesh(cakeGeo, cakeBodyMat);
      cakeBody.position.y = 0.4;
      group.add(cakeBody);

      // 4. Cake Frosting Glaze Top (with vendor photo mapped)
      const topFrostingGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.12, 32);
      const topFrosting = new THREE.Mesh(topFrostingGeo, foodTopMat);
      topFrosting.position.y = 0.85;
      group.add(topFrosting);

      // 5. Whipped Cream Swirls & Berries
      const creamGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const creamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const cherryGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const cherryMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.1, metalness: 0.2 });

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const cream = new THREE.Mesh(creamGeo, creamMat);
        cream.position.set(Math.cos(ang) * 0.9, 0.96, Math.sin(ang) * 0.9);
        group.add(cream);

        const cherry = new THREE.Mesh(cherryGeo, cherryMat);
        cherry.position.set(Math.cos(ang) * 0.9, 1.08, Math.sin(ang) * 0.9);
        group.add(cherry);
      }
      break;
    }

    case 'soup': {
      // 1. Ceramic Soup Bowl
      const bowlGeo = new THREE.CylinderGeometry(1.4, 0.8, 0.9, 32, 1, true);
      const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
      bowl.position.y = 0.45;
      group.add(bowl);

      const baseGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
      const bowlBase = new THREE.Mesh(baseGeo, ceramicMat);
      bowlBase.position.y = 0.05;
      group.add(bowlBase);

      // 2. Rich Soup Liquid (with photo texture mapped)
      const liquidGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.05, 32);
      const liquid = new THREE.Mesh(liquidGeo, foodTopMat);
      liquid.position.y = 0.75;
      group.add(liquid);

      // 3. Soup Garnishes & Meat chunks
      const herbGeo = new THREE.BoxGeometry(0.12, 0.01, 0.18);
      const herbMat = new THREE.MeshStandardMaterial({ color: 0x16a34a });
      for (let i = 0; i < 6; i++) {
        const herb = new THREE.Mesh(herbGeo, herbMat);
        herb.position.set((Math.random() - 0.5) * 1.2, 0.78, (Math.random() - 0.5) * 1.2);
        herb.rotation.y = Math.random() * Math.PI;
        group.add(herb);
      }
      break;
    }

    case 'drink': {
      // 1. Coaster
      const coasterGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.05, 32);
      const coaster = new THREE.Mesh(coasterGeo, woodenMat);
      coaster.position.y = 0.02;
      group.add(coaster);

      // 2. Glass Cup
      const glassGeo = new THREE.CylinderGeometry(0.75, 0.55, 1.8, 32);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.4,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = 0.95;
      group.add(glass);

      // 3. Liquid inside (with photo texture)
      const drinkGeo = new THREE.CylinderGeometry(0.7, 0.52, 1.5, 32);
      const drink = new THREE.Mesh(drinkGeo, foodTopMat);
      drink.position.y = 0.82;
      group.add(drink);

      // 4. Straw
      const strawGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 16);
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });
      const straw = new THREE.Mesh(strawGeo, strawMat);
      straw.position.set(0.2, 1.2, 0.1);
      straw.rotation.z = -0.2;
      group.add(straw);

      // 5. Lemon Slice
      const lemonGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.05, 24);
      const lemonMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      const lemon = new THREE.Mesh(lemonGeo, lemonMat);
      lemon.position.set(0.65, 1.85, 0);
      lemon.rotation.z = Math.PI / 3;
      group.add(lemon);
      break;
    }

    case 'grill': {
      // 1. Rustic BBQ Wooden Platter
      const platterGeo = new THREE.BoxGeometry(2.8, 0.1, 1.8);
      const platter = new THREE.Mesh(platterGeo, woodenMat);
      platter.position.y = 0.05;
      group.add(platter);

      // 2. Skewers / Mishkaki Sticks
      const skewerGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 16);
      const skewerMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
      const meatGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);

      for (let s = -1; s <= 1; s++) {
        const skewer = new THREE.Mesh(skewerGeo, skewerMat);
        skewer.rotation.z = Math.PI / 2;
        skewer.position.set(0, 0.22, s * 0.45);
        group.add(skewer);

        // Meat chunks on each skewer (textured with photo)
        for (let m = -3; m <= 3; m++) {
          const chunk = new THREE.Mesh(meatGeo, foodTopMat);
          chunk.position.set(m * 0.28, 0.22, s * 0.45);
          chunk.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4);
          group.add(chunk);
        }
      }

      // Lemon wedges on side
      const lemonGeo = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI);
      const lemonMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const lemon = new THREE.Mesh(lemonGeo, lemonMat);
      lemon.position.set(1.0, 0.15, -0.6);
      lemon.rotation.x = Math.PI / 2;
      group.add(lemon);
      break;
    }

    case 'plate_meal':
    default: {
      // 1. Ceramic Dish Plate
      const plateGeo = new THREE.CylinderGeometry(1.7, 1.2, 0.18, 36);
      const plate = new THREE.Mesh(plateGeo, ceramicMat);
      plate.position.y = 0.09;
      group.add(plate);

      // 2. Gold Outer Rim
      const rimGeo = new THREE.TorusGeometry(1.68, 0.05, 16, 36);
      const rim = new THREE.Mesh(rimGeo, goldRimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.18;
      group.add(rim);

      // 3. Fragrant Rice / Base Mound (Textured with food photo)
      const foodMoundGeo = new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3);
      const foodMound = new THREE.Mesh(foodMoundGeo, foodTopMat);
      foodMound.position.y = 0.15;
      group.add(foodMound);

      // 4. Main Protein (e.g. Crispy Roasted Chicken Quarter / Fish Cutlet / Grilled Steak)
      const proteinGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.35, 24);
      const proteinMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.4 }); // Golden roasted brown
      const protein = new THREE.Mesh(proteinGeo, proteinMat);
      protein.position.set(0.35, 0.45, 0.2);
      protein.rotation.set(0.2, 0.3, 0.15);
      group.add(protein);

      // 5. Side Vegetables & Herbs (Greens, Kachumbari, Tomato Slices)
      const vegGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });

      for (let i = 0; i < 7; i++) {
        const veg = new THREE.Mesh(vegGeo, i % 2 === 0 ? greenMat : redMat);
        const ang = (i / 7) * Math.PI + Math.PI;
        veg.position.set(Math.cos(ang) * 0.95, 0.26 + Math.random() * 0.05, Math.sin(ang) * 0.95);
        group.add(veg);
      }
      break;
    }
  }

  return group;
}

/**
 * Export Three.js food scene to a real GLB (glTF Binary) Blob
 */
export async function exportFoodSceneToGlb(sceneOrGroup: THREE.Object3D): Promise<Blob> {
  const scene = new THREE.Scene();
  scene.add(sceneOrGroup);

  // Add warm appetizing lighting to the exported scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffedd5, 1.8);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xfef3c7, 0.8);
  fillLight.position.set(-3, 3, -3);
  scene.add(fillLight);

  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          resolve(blob);
        } else {
          const output = JSON.stringify(gltf, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          resolve(blob);
        }
      },
      (error) => {
        console.error('GLTF export error:', error);
        reject(error);
      },
      {
        binary: true,
        embedImages: true,
      }
    );
  });
}

/**
 * Generate a complete, ready-to-use 3D food GLB URL for any dish
 */
export async function generate3DFoodModelUrl(options: Food3DGenerationOptions): Promise<{ blob: Blob; url: string; dishType: string }> {
  const foodType = options.dishType === 'auto' || !options.dishType 
    ? detectFoodType(options.productName, options.category) 
    : options.dishType;

  const foodGroup = await buildFoodScene({ ...options, dishType: foodType });
  const glbBlob = await exportFoodSceneToGlb(foodGroup);
  const blobUrl = URL.createObjectURL(glbBlob);

  return {
    blob: glbBlob,
    url: blobUrl,
    dishType: foodType,
  };
}
