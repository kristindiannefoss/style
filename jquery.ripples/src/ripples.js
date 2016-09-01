var gl;

function createProgram(vertexSource, fragmentSource, uniformValues)
{
	function compileSource(type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	const program = {
		id: gl.createProgram(),
		uniforms: {},
		locations: {}
	};

	gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
	gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
	gl.linkProgram(program.id);
	if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
		throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
	}

	// Fetch the uniform and attribute locations
	gl.useProgram(program.id);
	gl.enableVertexAttribArray(0);
	let name, type, regex = /uniform (\w+) (\w+)/g, shaderCode = vertexSource + fragmentSource;
	while ((match = regex.exec(shaderCode)) != null) {
		name = match[2];
		program.locations[name] = gl.getUniformLocation(program.id, name);
	}

	return program;
}

function bindTexture(texture, unit) {
	gl.activeTexture(gl.TEXTURE0 + (unit || 0));
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

class Ripples {

	constructor(resolution) {
		this.resolution = resolution;

		this.textureDelta = new Float32Array([1 / this.resolution, 1 / this.resolution]);

		this.canvas = document.createElement('canvas');
		this.context = this.canvas.getContext('webgl');

		this.claimContext();

		this.initRendertargets();
		this.initShaders();

    // Init quad
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      +1, -1,
      +1, +1,
      -1, +1
    ]), gl.STATIC_DRAW);

    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}

	initRendertargets() {

    // Load extensions
    gl.getExtension('OES_texture_float');
    const linearSupport = gl.getExtension('OES_texture_float_linear');

		this.textures = [];
		this.framebuffers = [];

		for (let i = 0; i < 2; i++) {
			const texture = gl.createTexture();
			const framebuffer = gl.createFramebuffer();

			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			framebuffer.width = this.resolution;
			framebuffer.height = this.resolution;

			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.resolution, this.resolution, 0, gl.RGBA, gl.FLOAT, null);

			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
				throw new Error('Rendering to this texture is not supported (incomplete framebuffer)');
			}

			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

			this.textures.push(texture);
			this.framebuffers.push(framebuffer);
		}

		this.readIndex = 0;
	}

	initShaders() {
		var vertexShader = [
			'attribute vec2 vertex;',
			'varying vec2 coord;',
			'void main() {',
				'coord = vertex * 0.5 + 0.5;',
				'gl_Position = vec4(vertex, 0.0, 1.0);',
			'}'
		].join('\n');

		this.dropProgram = createProgram(vertexShader, [
			'precision highp float;',

			'const float PI = 3.141592653589793;',
			'uniform sampler2D texture;',
			'uniform vec2 center;',
			'uniform float radius;',
			'uniform float strength;',

			'varying vec2 coord;',

			'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);',
				'drop = 0.5 - cos(drop * PI) * 0.5;',

				'info.r += drop * strength;',

				'gl_FragColor = info;',
			'}'
		].join('\n'));

		this.updateProgram = [0, 0];
		this.updateProgram[0] = createProgram(vertexShader, [
			'precision highp float;',

			'uniform sampler2D texture;',
			'uniform vec2 delta;',

			'varying vec2 coord;',

			'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'vec2 dx = vec2(delta.x, 0.0);',
				'vec2 dy = vec2(0.0, delta.y);',

				'float average = (',
					'texture2D(texture, coord - dx).r +',
					'texture2D(texture, coord - dy).r +',
					'texture2D(texture, coord + dx).r +',
					'texture2D(texture, coord + dy).r',
				') * 0.25;',

				'info.g += (average - info.r) * 2.0;',
				'info.g *= 0.995;',
				'info.r += info.g;',

				'gl_FragColor = info;',
			'}'
		].join('\n'));
		gl.uniform2fv(this.updateProgram[0].locations.delta, this.textureDelta);

		this.updateProgram[1] = createProgram(vertexShader, [
			'precision highp float;',

			'uniform sampler2D texture;',
			'uniform vec2 delta;',

			'varying vec2 coord;',

			'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);',
				'vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);',
				'info.ba = normalize(cross(dy, dx)).xz;',

				'gl_FragColor = info;',
			'}'
		].join('\n'));
		gl.uniform2fv(this.updateProgram[1].locations.delta, this.textureDelta);

		this.renderProgram = createProgram([
			'precision highp float;',

			'attribute vec2 vertex;',

			'uniform vec2 backgroundPosition;',
			'uniform vec2 backgroundSize;',
			'uniform vec2 containerRatio;',

			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',

			'void main() {',
				'backgroundCoord = (vertex - backgroundPosition) / backgroundSize;',
				'ripplesCoord = vec2(vertex.x, vertex.y) * containerRatio * 0.5 + 0.5;',
				'gl_Position = vec4(vertex.x, vertex.y, 0.0, 1.0);',
			'}'
		].join('\n'), [
			'precision highp float;',

			'uniform sampler2D samplerBackground;',
			'uniform sampler2D samplerRipples;',
			'uniform float perturbance;',

			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',

			'void main() {',
				'vec2 offset = -texture2D(samplerRipples, ripplesCoord).ba;',
				'float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);',
				'gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance) + specular;',
			'}'
		].join('\n'));
	}

	drawQuad() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	}

	renderAndSwap(func) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[1 - this.readIndex]);
		bindTexture(this.textures[this.readIndex]);

		func();

		this.readIndex = 1 - this.readIndex;
	}

	claimContext() {
		gl = this.context;
	}

	setBackground(image) {
		if (!this.backgroundTexture) {
			this.backgroundTexture = gl.creatTexture();

			gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		}
		else {
			gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		}

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	}

	updateSimulation() {
		const self = this;

		gl.viewport(0, 0, this.resolution, this.resolution);

		for (let i = 0; i < 2; i++) {
			renderAndSwap(function() {
				gl.useProgram(self.updateProgram[i].id);

				self.drawQuad();
			});
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	render(options) {
		if (!this.backgroundTexture) {
			return;
		}

		const maxSide = Math.max(this.canvas.width, this.canvas.height);
		const containerRatio = new Float32Array([
			this.canvas.width / maxSide,
			this.canvas.height / maxSide
		]);

		const backgroundPosition = new Float32Array([
			(options.backgroundX || 0) / this.canvas.width,
			(options.backgroundY || 0) / this.canvas.height
		]);

		const backgroundScale = new Float32Array([
			(options.backgroundWidth || this.canvas.width) / this.canvas.width,
			-(options.backgroundHeight || this.canvas.height) / this.canvas.height
		]);

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		gl.enable(gl.BLEND);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(this.renderProgram.id);

		bindTexture(this.backgroundTexture, 0);
		bindTexture(this.textures[this.readIndex], 1);

		gl.uniform1f(this.renderProgram.locations.perturbance, this.perturbance);
		gl.uniform2fv(this.renderProgram.locations.backgroundPosition, backgroundPosition);
		gl.uniform2fv(this.renderProgram.locations.backgroundScale, backgroundScale);
		gl.uniform2fv(this.renderProgram.locations.containerRatio, containerRatio);
		gl.uniform1i(this.renderProgram.locations.samplerBackground, 0);
		gl.uniform1i(this.renderProgram.locations.samplerRipples, 1);

		this.drawQuad();

		gl.disable(gl.BLEND);
	}

	drop(x, y, radius, strength) {
		const self = this,
					dropPosition = new Float32Array([x / this.canvas.width, 1 - y / this.canvas.height]);

		gl.viewport(0, 0, this.resolution, this.resolution);

		renderAndSwap(function() {
			gl.useProgram(self.dropProgram.id);
			gl.uniform2fv(self.dropProgram.locations.center, dropPosition);
			gl.uniform1f(self.dropProgram.locations.radius, radius);
			gl.uniform1f(self.dropProgram.locations.strength, strength);

			self.drawQuad();
		});

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
}

function browserSupportsRipples() {
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('webgl');
  var result = context && context.getExtension('OES_texture_float');
  return result;
}

Ripples.isSupported = browserSupportsRipples();

export default Ripples;