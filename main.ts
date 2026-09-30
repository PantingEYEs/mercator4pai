import { vec3, quat, mat3 } from 'gl-matrix';

const canvas = document.getElementById('gpuCanvas') as HTMLCanvasElement;
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("WebGPU adapter not available");
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu') as GPUCanvasContext;
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const quadVertexData = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
]);
const vertexBuffer = device.createBuffer({
    size: quadVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});
new Float32Array(vertexBuffer.getMappedRange()).set(quadVertexData);
vertexBuffer.unmap();

const uniformBufferSize = 4 * 16;
const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

function computeLocalBasisFromEuler(pitch: number, yaw: number, roll: number, theta: number) {
    const q = quat.create();
    quat.fromEuler(q, pitch * 180/Math.PI, yaw * 180/Math.PI, roll * 180/Math.PI);
    const R = mat3.create();
    mat3.fromQuat(R, q);
    const W = vec3.fromValues(R[1], R[4], R[7]);
    const U = vec3.fromValues(R[0], R[3], R[6]);
    const V = vec3.cross(vec3.create(), W, U);
    vec3.normalize(W, W);
    vec3.normalize(U, U);
    vec3.normalize(V, V);
    return { W, U, V, theta };
}

const UNIT_STEP = 2 * Math.PI / 100;
const STEPS_PER_CYCLE = 200;

function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function processInput(input: number): { display: number, steps: number } {
    const display = mod(input + 1, 2) - 1;
    const steps = Math.round(mod(input * 100/2 + 100, STEPS_PER_CYCLE));
    return { display, steps };
}

function updateUniforms() {
    const xInput = document.getElementById('x') as HTMLInputElement;
    const yInput = document.getElementById('y') as HTMLInputElement;
    const zInput = document.getElementById('z') as HTMLInputElement;
    const thetaInput = document.getElementById('theta') as HTMLInputElement;

    const xVal = parseFloat(xInput.value);
    const yVal = parseFloat(yInput.value);
    const zVal = parseFloat(zInput.value);
    const thetaVal = parseFloat(thetaInput.value);

    const { display: xDisplay, steps: xSteps } = processInput(xVal);
    const { display: yDisplay, steps: ySteps } = processInput(yVal);
    const { display: zDisplay, steps: zSteps } = processInput(zVal);
    const { display: thetaDisplay, steps: thetaSteps } = processInput(thetaVal);

    xInput.value = xDisplay.toFixed(2);
    yInput.value = yDisplay.toFixed(2);
    zInput.value = zDisplay.toFixed(2);
    thetaInput.value = thetaDisplay.toFixed(2);

    let accumulatedAngleX = 0;
    let accumulatedAngleY = 0;
    let accumulatedAngleZ = 0;
    let accumulatedTheta  = 0;

    accumulatedAngleX += xSteps * UNIT_STEP;
    accumulatedAngleY += ySteps * UNIT_STEP;
    accumulatedAngleZ += zSteps * UNIT_STEP;
    accumulatedTheta  += thetaSteps * UNIT_STEP;

    const basis = computeLocalBasisFromEuler(
        accumulatedAngleX,
        accumulatedAngleY,
        accumulatedAngleZ,
        accumulatedTheta
    );

    const data = new Float32Array([
        ...basis.W, 0,
        ...basis.U, 0,
        ...basis.V, 0,
        accumulatedTheta, 0, 0, 0,
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, data.buffer);
}

async function loadTexture(device: GPUDevice, url: string) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const bitmap = await createImageBitmap(img);

    const texture = device.createTexture({
        size: [bitmap.width, bitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture },
        [bitmap.width, bitmap.height]
    );

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    return { texture, sampler };
}

const { texture: T, sampler: sampler0 } = await loadTexture(device, './assets/Mercator.JPG');

const shaderModule = device.createShaderModule({
    code: await fetch('./shader.wgsl').then(r => r.text())
});

const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
            arrayStride: 2 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
        }]
    },
    fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
});

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: T.createView() },
        { binding: 2, resource: sampler0 }
    ]
});

function render() {
    updateUniforms();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(6, 1, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);
}

['x','y','z','theta'].forEach(id => {
    (document.getElementById(id) as HTMLInputElement).addEventListener('input', render);
});

render();
