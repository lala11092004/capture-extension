'use strict';

function g(id) {
	return document.getElementById(id);
}
function bind(context, fn) {
	return function(value) {
		return fn.call(context, value);
	};
}
function getSubstance(func) {
	return func.toString().replace(/[\t\r\n]/g, '').match(/\{(.*)\}/)[1];
}
function exe(code) {
	var deferred = createDeferred();
	chrome.tabs.executeScript(null, {code: code}, bind(deferred, function(result) {
		this.resolve(result[0]);
	}));
	return deferred.promise;
}
function captureFullPage(info) {
	var canvas, ctx, firstCapture, deferred;
	canvas = document.createElement('canvas');
	canvas.width = info.imageSize[0];
	canvas.height = info.imageSize[1];
	firstCapture = true;
	deferred = createDeferred();
	ctx = canvas.getContext('2d');
	ctx._info = info;
	ctx.$draw = bind(ctx, function(img) {
		var clip = firstCapture ? img.height : Math.floor(img.height * 0.6);
		this.drawImage(img, 0, 0, img.width, clip, this._info.currentPosition[0], this._info.currentPosition[1], img.width, clip);
		firstCapture = false;
		return this._info.currentPosition.concat(clip);
	});
	ctx.$resolve = deferred.resolve;
	ctx.$scroll = function(x, y) {
		return exe('scrollTo(' + x + ',' + y + ');[scrollX, scrollY]');
	};
	ctx.$capture = function() {
		var deferred = createDeferred();
		chrome.tabs.captureVisibleTab(null, {format: 'png'}, bind(deferred, function(dataUrl) {
			var img = new Image();
			img.src = dataUrl;
			deferred.resolve(img);
		}));
		return deferred.promise;
	};
	ctx.$handler = bind(ctx, function() {
		this.$capture().then(bind(this, function(img) {
			var pos = this.$draw(img);
			if (pos[0] * pos[1] === 0) {
				this.$resolve(this.canvas.toDataURL());
			} else {
				echo('captureFullPagee');
				this.$scroll(pos[0], pos[1] - pos[2]).then(bind(this, function(cpos) {
					this._info.currentPosition = cpos;
					this.capture();
				}));
			}
		}));
	});
	ctx.$handler();
	return deferred.promise;
}
function dataUrlToBlob(dataUrl){
	var byteString, mimeString, ab, ia;
	byteString = atob(dataUrl.split(',')[1]);
	mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
	ab = new ArrayBuffer(byteString.length);
	ia = new Uint8Array(ab);
	for (var i = byteString.length; i--; ) {
		ia[i] = byteString.charCodeAt(i);
	}
	return new Blob([ab], {type: mimeString});
}

var app = {
	status: g('status'),
	setStatus: function(str) {
		this.status.innerHTML = str;
		return str;
	},
	initializer: function() {
		var obj = document.getElementsByTagName("body")[0];
		obj = {
			imageSize: [obj.offsetWidth, obj.offsetHeight],
			windowSize: [innerWidth, innerHeight],
			initialPosition: [scrollX, scrollY]
		};
		scrollTo(0, obj.imageSize[1]);
		obj.currentPosition = [scrollX, scrollY];
		obj;
	},
};

app.setStatus('スクリーンキャプチャ作成中です。');
function echo(x) {
	document.getElementById('console').insertAdjacentHTML('BeforeEnd', x + '<br>');
}

exe(getSubstance(app.initializer)).then(function(info) {
	return captureFullPage(info);
}).then(function(promise) {
	promise.then(function(dataUrl) {
		var img = g('test');
		img.src = dataUrl;
	});
});
