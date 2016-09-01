var $window = $(window); // There is only one window, so why not cache the jQuery-wrapped window?

function isPercentage(str) {
  return str[str.length - 1] == '%';
}

function getBackgroundImageUrl($el) {
  var urlMatch = /url\(["']?([^"']*)["']?\)/.exec($el.css('background-image'));
  if (urlMatch == null) return null;

  return urlMatch[1];
}

function isDataUri(url) {
  return url.match(/^data:/);
}

// Extend the css
$('head').prepend('<style>.jquery-ripples { position: relative; z-index: 0; }</style>');

// RIPPLES CLASS DEFINITION
// =========================

class RipplesPlugin {

  constructor(el, options) {
    var that = this;

    this.$el = $(el);
    this.$el.addClass('jquery-ripples');

    this.ripplesSimulation = new Ripples(options.resolution);
    this.ripplesSimulation.claimGLContext();

    this.interactive = options.interactive;
    this.perturbance = options.perturbance;
    this.dropRadius = options.dropRadius;

    if (this.$el.is('img, canvas, video')) {
      this.ripplesSimulation.setBackground(this.$el[0]);
      this.visible = true;
    }
    else {

      const backgroundUrl = getBackgroundImageUrl(this.$el);
      if (!backgroundUrl) return;

      // Make image of CSS background image
      const targetImage = new Image;
      targetImage.src = backgroundUrl;

      // Disable CORS when the image source is a data URI.
      targetImage.crossOrigin = isDataUri(backgroundUrl) ? null : options.crossOrigin || '';

      image.onload = function onLoad() {
        that.ripplesSimulation.claimGLContext();
        that.ripplesSimulation.setBackground(this);

        // Everything loaded successfully - hide the CSS background image
        that.$el.css('backgroundImage', 'none');

        that.visible = true;
      };

      image.src = backgroundUrl;

      this.isBackgroundEffect = true;
    }

    // Style the canvas the simulation draws on
    var canvas = this.ripplesSimulation.canvas;
    canvas.width = this.$el.innerWidth();
    canvas.height = this.$el.innerHeight();
    this.canvas = canvas;
    this.$canvas = $(canvas);
    this.$canvas.css({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: -1
    });

    this.$el.append(canvas);

    // Init events
    $(window).on('resize', function() {
      if (that.$el.innerWidth() != that.canvas.width || that.$el.innerHeight() != that.canvas.height) {
        canvas.width = that.$el.innerWidth();
        canvas.height = that.$el.innerHeight();
      }
    });

    this.$el.on('mousemove.ripples', function(e) {
      if (that.visible && that.running && that.interactive) that.dropAtMouse(e, that.dropRadius, 0.01);
    }).on('mousedown.ripples', function(e) {
      if (that.visible && that.running && that.interactive) that.dropAtMouse(e, that.dropRadius * 1.5, 0.14);
    });

    // Init animation
    function step() {
      that.step();
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  step() {
    gl = this.context;

    if (!this.visible) {
      return;
    }

    if (this.running) {
      this.update();
    }

    this.render();
  },

  render() {
    let options;

    if (this.isBackgroundEffect) {
      options = getBackgroundPositionAndSize();
    }
    else {
      options = {};
    }

    this.ripplesSimulation.render(options);
  },

  update() {
    this.ripplesSimulation.update();
  },

  dropAtMouse: function(e, radius, strength) {
    this.drop(
      e.pageX - this.$el.offset().left,
      e.pageY - this.$el.offset().top,
      radius,
      strength
    );
  },

  drop: function(x, y, radius, strength) {

  },

  // Actions
  destroy: function() {
    this.canvas.remove();
    this.$el.off('.ripples');
    this.$el.css('backgroundImage', '');
    this.$el.removeClass('jquery-ripples').removeData('ripples');
  },

  show: function() {
    this.$canvas.show();
    this.$el.css('backgroundImage', 'none');
    this.visible = true;
  },

  hide: function() {
    this.$canvas.hide();
    this.$el.css('backgroundImage', '');
    this.visible = false;
  },

  pause: function() {
    this.running = false;
  },

  play: function() {
    this.running = true;
  },

  set: function(property, value)
  {
    switch (property)
    {
      case 'dropRadius':
      case 'perturbance':
      case 'interactive':
        this[property] = value;
        break;
    }
  }
};

RipplesPlugin.DEFAULTS = {
  resolution: 256,
  dropRadius: 20,
  perturbance: 0.03,
  interactive: true,
  crossOrigin: ''
};

// RIPPLES PLUGIN DEFINITION
// ==========================

var old = $.fn.ripples;

$.fn.ripples = function(option) {
  if (!Ripples.isSupported()) throw new Error('Your browser does not support WebGL or the OES_texture_float extension.');

  var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : undefined;

  return this.each(function() {
    var $this   = $(this);
    var data    = $this.data('ripples');
    var options = $.extend({}, RipplesPlugin.DEFAULTS, $this.data(), typeof option == 'object' && option);

    if (!data && typeof option == 'string') return;
    if (!data) $this.data('ripples', (data = new RipplesPlugin(this, options)));
    else if (typeof option == 'string') RipplesPlugin.prototype[option].apply(data, args);
  });
}

$.fn.ripples.Constructor = RipplesPlugin;


// RIPPLES NO CONFLICT
// ====================

$.fn.ripples.noConflict = function() {
  $.fn.ripples = old;
  return this;
}

}(window.jQuery);
