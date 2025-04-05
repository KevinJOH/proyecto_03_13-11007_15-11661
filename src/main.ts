// Importación de librerías y módulos necesarios
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as dat from 'dat.gui';

// Importación de shaders
import vertexShader from './shaders/pp_vertex.glsl';
import DoFFragmentShader from './shaders/pp_frag_DoF.glsl';

interface ShaderDefinition {
  uniforms: Record<string, { value: any }>;
  vertexShader: string;
  fragmentShader: string;
}

interface Effect {
  pass: ShaderPass;
  name: string;
  enabled: boolean;
  params?: Record<string, any>;
}

const blurShader: ShaderDefinition = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uBlurAmount: { value: 10.0 },
    uFocusDistance: { value: 0.0 },
    uFocusRange: { value: 0.5 },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 1000.0 }
  },
  vertexShader,
  fragmentShader: DoFFragmentShader,
};

class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private effects: Map<string, Effect>;
  private gui: dat.GUI;
  private showGUI: boolean = true;
  private renderTarget: THREE.WebGLRenderTarget;
  private cameraOverlay: THREE.Sprite;

  constructor() {
    // Setup scene
    this.scene = new THREE.Scene();

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,  
      1000
    );
    this.camera.position.z = 5;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Configurar render target con depthTexture
    this.renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    this.renderTarget.depthTexture = new THREE.DepthTexture();
    this.renderTarget.depthTexture.type = THREE.UnsignedShortType;

    const textureLoader = new THREE.TextureLoader();
    // Fondo: se pueden alternar imágenes según se requiera
    const backgroundTexture = textureLoader.load('static/img/imagen1.jpg');
    const backgroundTexture2 = textureLoader.load('static/img/imagen2.jpg');
    const backgroundTexture3 = textureLoader.load('static/img/imagen3.jpg');
    const backgroundTexture4 = textureLoader.load('static/img/imagen4.jpg');
    const backgroundTexture5 = textureLoader.load('static/img/imagen5.jpg');
    this.scene.background = backgroundTexture;
    // Listener para cambiar la imagen de fondo con la tecla Enter
    let currentBackgroundIndex = 0;
    const backgroundTextures = [backgroundTexture, backgroundTexture2, backgroundTexture3, backgroundTexture4, backgroundTexture5];
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
      currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundTextures.length;
      this.scene.background = backgroundTextures[currentBackgroundIndex];
      }
    });

    // Orbit controls
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;

    // Crear overlay de cámara
    this.createCameraOverlay(textureLoader);

    // Post-processing setup utilizando el renderTarget con depthTexture
    this.setupPostProcessing();

    // Event listener para resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // event tamaño de la camara
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderTarget.setSize(window.innerWidth, window.innerHeight);

    // GUI setup
    this.setupGUI();

    // Listener para togglear GUI y overlay con la barra espaciadora
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        this.showGUI = !this.showGUI;
        // Muestra u oculta el panel de dat.GUI
        this.gui.domElement.style.display = this.showGUI ? 'block' : 'none';
      }
    });

    // Listener para mover el overlay con el mouse
    window.addEventListener('mousemove', (event: MouseEvent) => {
      // Convertir las coordenadas del mouse a Normalized Device Coordinates (NDC)
      const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      // Se establece una posición en cámara: ajusta la profundidad (z) según convenga
      // Por ejemplo, ubicamos el overlay a -2 unidades en el espacio local de la cámara
      this.cameraOverlay.position.set(mouseX, mouseY, 4);
    });


    // Inicia la animación
    this.animate();
  }

  private createCameraOverlay(textureLoader: THREE.TextureLoader): void {
    const overlayTexture = textureLoader.load('static/img/Camara.png');
    const overlayMaterial = new THREE.SpriteMaterial({ map: overlayTexture, transparent: true });
    this.cameraOverlay = new THREE.Sprite(overlayMaterial);
    // Ajustar escala y posición para que ocupe la vista completa o el marco deseado
    this.cameraOverlay.scale.set(window.innerWidth * 0.0005, window.innerHeight * 0.0005, 1);
    this.cameraOverlay.position.set(0, 0, 0);
    // Se añade al canvas 2D o directamente a la escena, en este caso a la escena
    this.scene.add(this.cameraOverlay);
    this.cameraOverlay.visible = true;
  }

  private setupPostProcessing(): void {
    // Usamos el renderTarget configurado para capturar la profundidad
    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.effects = new Map<string, Effect>();
    this.addEffect('backgroundBlur', blurShader);
  }

  private addEffect(name: string, shaderDefinition: ShaderDefinition): void {
    const material = new THREE.RawShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(shaderDefinition.uniforms),
      vertexShader: shaderDefinition.vertexShader,
      fragmentShader: shaderDefinition.fragmentShader,
      glslVersion: THREE.GLSL3,
    });
    const pass = new ShaderPass(material);
    // Se añade el shader pass al composer
    this.composer.addPass(pass);
    this.effects.set(name, { pass, name, enabled: true });
  }

  
  private setupGUI(): void {
    this.gui = new dat.GUI();
    const blurEffect = this.effects.get('backgroundBlur');
    if (blurEffect) {
      this.gui.add(blurEffect.pass.uniforms['uBlurAmount'], 'value', 0.0, 10.0).name('Desenfoque');
      this.gui.add(blurEffect.pass.uniforms['uFocusDistance'], 'value', 0.0, 1.0).name('Distancia');
      this.gui.add(blurEffect.pass.uniforms['uFocusRange'], 'value', 0.1, 0.5).name('Rango');
      this.gui.add(this.cameraOverlay.scale, 'x', window.innerWidth*0.0005, window.innerWidth*0.0015).name('Ancho');
      this.gui.add(this.cameraOverlay.scale, 'y', window.innerHeight*0.0005, window.innerHeight*0.0015).name('Alto');
      // Se ajusta la escala del overlay de cámara al tamaño de la ventana
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    // Actualiza la escala del overlay de cámara
    this.cameraOverlay.scale.set(window.innerWidth * 0.0015, window.innerHeight * 0.0015, 1);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    // Actualiza el uniform de profundidad en cada frame
    const blurEffect = this.effects.get('backgroundBlur');
    if (blurEffect) {
      blurEffect.pass.uniforms['tDepth'].value = this.renderTarget.depthTexture;
      // También se pueden actualizar parámetros de cámara para la linealización de la profundidad
      blurEffect.pass.uniforms['uCameraNear'].value = this.camera.near;
      blurEffect.pass.uniforms['uCameraFar'].value = this.camera.far;
    }
    this.composer.render();
  }
}

new App();