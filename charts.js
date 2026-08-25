(function () {
  "use strict";

  function svgEscape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function buildAxis(points, width, height, padding) {
    var values = points.map(function (point) { return point.value; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;
    var headroom = Math.max(1, range * 0.12);
    min = Math.max(0, min - headroom);
    max += headroom;
    var left = padding.left;
    var right = width - padding.right;
    var top = padding.top;
    var bottom = height - padding.bottom;
    var xStep = points.length > 1 ? (right - left) / (points.length - 1) : 0;

    return {
      min: min,
      max: max,
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      xStep: xStep,
      point: function (index, value) {
        return {
          x: left + index * xStep,
          y: top + (bottom - top) * (1 - (value - min) / (max - min))
        };
      }
    };
  }

  function pathFromValues(values, scale) {
    return values.map(function (value, index) {
      var point = scale.point(index, value);
      return (index === 0 ? "M" : "L") + point.x.toFixed(2) + " " + point.y.toFixed(2);
    }).join(" ");
  }

  function lineChart(container, config) {
    var width = config.width || 820;
    var height = config.height || 300;
    var padding = config.padding || { top: 18, right: 16, bottom: 34, left: 52 };
    var series = config.series || [];
    var allValues = [];
    series.forEach(function (item) {
      item.points.forEach(function (point) { allValues.push(point.value); });
    });
    var scale = buildAxis([{ value: Math.min.apply(null, allValues) }, { value: Math.max.apply(null, allValues) }], width, height, padding);
    var min = scale.min;
    var max = scale.max;
    var longestSeries = series.reduce(function (best, item) {
      return item.points.length > best.points.length ? item : best;
    }, series[0] || { points: [] });
    var maxPointCount = Math.max(1, longestSeries.points.length);
    scale = {
      min: min,
      max: max,
      left: padding.left,
      right: width - padding.right,
      top: padding.top,
      bottom: height - padding.bottom,
      xStep: maxPointCount > 1 ? (width - padding.right - padding.left) / (maxPointCount - 1) : 0,
      point: function (index, value) {
        return {
          x: padding.left + index * ((width - padding.right - padding.left) / Math.max(1, maxPointCount - 1)),
          y: padding.top + (height - padding.top - padding.bottom) * (1 - (value - min) / (max - min))
        };
      }
    };

    var grid = [];
    for (var i = 0; i <= 4; i++) {
      var value = min + (max - min) * i / 4;
      var y = scale.point(0, value).y;
      grid.push(
        '<line x1="' + padding.left + '" y1="' + y.toFixed(2) + '" x2="' + (width - padding.right) + '" y2="' + y.toFixed(2) + '" stroke="#e5eaf1" stroke-width="1"/>',
        '<text x="' + (padding.left - 7) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end" font-size="11" fill="#7b8798">' + value.toFixed(value >= 100 ? 0 : 2) + "</text>"
      );
    }

    var labels = [];
    var first = longestSeries.points;
    var labelCount = Math.min(6, first.length);
    for (var l = 0; l < labelCount; l++) {
      var index = Math.round((first.length - 1) * l / Math.max(1, labelCount - 1));
      var point = scale.point(index, first[index] ? first[index].value : 0);
      labels.push('<text x="' + point.x.toFixed(2) + '" y="' + (height - 12) + '" text-anchor="middle" font-size="10" fill="#7b8798">' + svgEscape(first[index].date || "") + "</text>");
    }

    var paths = series.map(function (item) {
      var d = pathFromValues(item.points.map(function (point) { return point.value; }), scale);
      var stroke = item.color || "#0f766e";
      var dash = item.dash ? ' stroke-dasharray="6 6"' : "";
      var fill = item.fill ? '<path d="' + d + ' L ' + scale.point(item.points.length - 1, scale.min).x.toFixed(2) + " " + (height - padding.bottom) + " L " + scale.point(0, scale.min).x.toFixed(2) + " " + (height - padding.bottom) + ' Z" fill="' + item.fill + '" opacity="0.16"/>' : "";
      var animation = config.animatePath && !item.dash
        ? ' class="chart-path-reveal" pathLength="1000" style="animation-duration:' + (config.animationDuration || 600) + 'ms"'
        : "";
      return fill + '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + (item.width || 3) + '"' + dash + animation + ' stroke-linejoin="round"/>';
    }).join("");

    var dots = "";
    var lastSeries = series[series.length - 1];
    if (lastSeries && lastSeries.points.length) {
      var last = scale.point(lastSeries.points.length - 1, lastSeries.points[lastSeries.points.length - 1].value);
      dots = '<circle cx="' + last.x.toFixed(2) + '" cy="' + last.y.toFixed(2) + '" r="5" fill="' + (lastSeries.color || "#0f766e") + '" stroke="#ffffff" stroke-width="2"/>';
    }

    container.innerHTML = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + svgEscape(config.title || "价格趋势图") + '">' +
      '<rect width="' + width + '" height="' + height + '" fill="#ffffff"/>' +
      grid.join("") +
      paths +
      dots +
      labels.join("") +
      "</svg>";
  }

  window.NZX_CHARTS = {
    lineChart: lineChart
  };
})();
