struct Uniforms {
    W: vec4<f32>,
    U: vec4<f32>,
    V: vec4<f32>,
    theta: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var T: texture_2d<f32>;
@group(0) @binding(2) var sampler0: sampler;

struct VertexOut {
    @builtin(position) position: vec4<f32>,
    @location(0) fragCoord: vec4<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec2<f32>) -> VertexOut {
    var out: VertexOut;
    out.position = vec4(pos, 0.0, 1.0);
    out.fragCoord = vec4((pos + vec2(1.0, 1.0)) * 0.5 * vec2(3047.0, 6831.0), 0.0, 0.0);
    return out;
}

@fragment
fn fs_main(fragIn: VertexOut) -> @location(0) vec4<f32> {
    let fragCoord = fragIn.fragCoord;
    let h = 6831.0;
    let w = 3047.0;
    let r = w / (2.0 * 3.1415926);

    let u1 = floor(fragCoord.y / 1) + 0.5;
    let v1 = floor(fragCoord.x / 1) + 0.5;

    let W = uniforms.W.xyz;
    let U = uniforms.U.xyz;
    let V = uniforms.V.xyz;
    let j = uniforms.theta.x;

    let p2 = (u1 - h / 2.0) * W + r * cos(v1 / r + j) * U + r * sin(v1 / r + j) * V;
    let d = normalize(p2);
    let sin_alpha = sin(atan(h / r));
    let denom = sqrt(d.x * d.x + d.z * d.z);
    let valid = f32((abs(d.y) <= sin_alpha) && (denom >= 1e-6));
    let t = r / max(denom, 1e-6);
    let p1 = d * t;
    let phi = atan2(p1.z, p1.x) + 3.1415926;
    let u_tex = (r * phi) / (2.0 * 3.1415926 * r);
    let v_tex = (p1.y + h / 2.0) / h;
    let color_tex = textureSample(T, sampler0, vec2(u_tex, v_tex));
    let color_black = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    let final_color = select(color_black, vec4<f32>(color_tex.rgb, 1.0), valid == 1.0);
    return final_color;
}
