function getTwo(value) {
  const result = value.split(' ');

  result[0] = result[0] || '';
  result[1] = result[1] || result[0];

  return result;
}



export function computeImageBoundaries(originalImageWidth, originalImageHeight, element) {
  let {
    backgroundSize,
    backgroundAttachment,
    backgroundPosition
  } = getComputedStyle(element);

  let container;
  if (backgroundAttachment == 'fixed') {
    container = {
      x: 0,
      y: 0,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    };
  }
  else {
    container = {
      x: 0,
      y: 0,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    };
  }

  // Here the 'window' is the element which the background adapts to
  // (either the chrome window or some element, depending on attachment)
  var parElement = backgroundAttachment == 'fixed' ? $window : this.$el;
  var winOffset = parElement.offset() || {left: pageXOffset, top: pageYOffset};
  var winWidth = parElement.innerWidth();
  var winHeight = parElement.innerHeight();

  function getBackgroundSize(cssValue) {
    let backgroundWidth,
        backgroundHeight;

    switch (cssValue) {
      case 'cover':
      case 'contain':
        var scale1 = winWidth / this.backgroundWidth,
            scale2 = winHeight / this.backgroundHeight;
        var scale = cssValue == 'contain' ? Math.min(scale1, scale2) : Math.max(scale1, scale2);

        return [
          this.backgroundWidth * scale,
          this.backgroundHeight * scale
        ];
      default:
        backgroundSize = getTwo(backgroundSize);

        var backgroundWidth = backgroundSize[0],
            backgroundHeight = backgroundSize[1];

        if (isPercentage(backgroundWidth)) {
          backgroundWidth = winWidth * parseFloat(backgroundWidth) / 100;
        }
        else if (backgroundWidth != 'auto') {
          backgroundWidth = parseFloat(backgroundWidth);
        }

        if (isPercentage(backgroundHeight)) {
          backgroundHeight = winHeight * parseFloat(backgroundHeight) / 100;
        }
        else if (backgroundHeight != 'auto') {
          backgroundHeight = parseFloat(backgroundHeight);
        }

        if (backgroundWidth == 'auto' && backgroundHeight == 'auto') {
          backgroundWidth = this.backgroundWidth;
          backgroundHeight = this.backgroundHeight;
        }
        else {
          if (backgroundWidth == 'auto') {
            backgroundWidth = this.backgroundWidth * (backgroundHeight / this.backgroundHeight);
          }

          if (backgroundHeight == 'auto') {
            backgroundHeight = this.backgroundHeight * (backgroundWidth / this.backgroundWidth);
          }
        }
        return [
          backgroundWidth,
          backgroundHeight
        ];
    }
  }

  // Compute backgroundX and backgroundY in page coordinates
  backgroundPosition = getTwo(backgroundPosition);
  var backgroundX = backgroundPosition[0],
      backgroundY = backgroundPosition[1];

  if (backgroundX == 'left') backgroundX = winOffset.left;
  else if (backgroundX == 'center') backgroundX = winOffset.left + winWidth / 2 - backgroundWidth / 2;
  else if (backgroundX == 'right') backgroundX = winOffset.left + winWidth - backgroundWidth;
  else if (isPercentage(backgroundX)) {
    backgroundX = winOffset.left + (winWidth - backgroundWidth) * parseFloat(backgroundX) / 100;
  }
  else {
    backgroundX = parseFloat(backgroundX);
  }

  if (backgroundY == 'top') backgroundY = winOffset.top;
  else if (backgroundY == 'center') backgroundY = winOffset.top + winHeight / 2 - backgroundHeight / 2;
  else if (backgroundY == 'bottom') backgroundY = winOffset.top + winHeight - backgroundHeight;
  else if (isPercentage(backgroundY)) {
    backgroundY = winOffset.top + (winHeight - backgroundHeight) * parseFloat(backgroundY) / 100;
  }
  else {
    backgroundY = parseFloat(backgroundY);
  }
};