import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/bitmoji.glb` }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/idle.glb` }),
    danceAnim: new pc.Asset('danceAnim', 'container', {
        url: `${rootPath}/static/assets/animations/bitmoji/win-dance.glb`
    }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bloom: new pc.Asset('bloom', 'script', { url: `${rootPath}/static/scripts/posteffects/posteffect-bloom.js` })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // setup skydome
    app.scene.exposure = 2;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    cameraEntity.translate(0, 0.75, 3);

    // add bloom postprocessing (this is ignored by the picker)
    cameraEntity.addComponent('script');
    cameraEntity.script.create('bloom', {
        attributes: {
            bloomIntensity: 1,
            bloomThreshold: 0.7,
            blurAmount: 4
        }
    });
    app.root.addChild(cameraEntity);

    // Create an entity with a light component
    const lightEntity = new pc.Entity();
    lightEntity.addComponent('light', {
        castShadows: true,
        intensity: 1.5,
        normalOffsetBias: 0.02,
        shadowType: pc.SHADOW_PCF5_32F,
        shadowDistance: 6,
        shadowResolution: 2048,
        shadowBias: 0.02
    });
    app.root.addChild(lightEntity);
    lightEntity.setLocalEulerAngles(45, 30, 0);

    // create an entity from the loaded model using the render component
    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });

    // add an anim component to the entity
    modelEntity.addComponent('anim', {
        activate: true
    });

    // create an anim state graph
    const animStateGraphData = {
        layers: [
            {
                name: 'characterState',
                states: [
                    {
                        name: 'START'
                    },
                    {
                        name: 'Movement',
                        speed: 1.0,
                        loop: true,
                        blendTree: {
                            type: '1D',
                            parameter: 'blend',
                            children: [
                                {
                                    name: 'Idle',
                                    point: 0.0
                                },
                                {
                                    name: 'Dance',
                                    point: 1.0,
                                    speed: 0.85
                                }
                            ]
                        }
                    }
                ],
                transitions: [
                    {
                        from: 'START',
                        to: 'Movement'
                    }
                ]
            }
        ],
        parameters: {
            blend: {
                name: 'blend',
                type: 'FLOAT',
                value: 0
            }
        }
    };

    // load the state graph into the anim component
    modelEntity.anim.loadStateGraph(animStateGraphData);

    // load the state graph asset resource into the anim component
    const characterStateLayer = modelEntity.anim.baseLayer;
    characterStateLayer.assignAnimation('Movement.Idle', assets.idleAnim.resource.animations[0].resource);
    characterStateLayer.assignAnimation('Movement.Dance', assets.danceAnim.resource.animations[0].resource);

    app.root.addChild(modelEntity);

    data.on('blend:set', (/** @type {number} */ blend) => {
        modelEntity.anim.setFloat('blend', blend);
    });

    app.start();
});

export { app };
