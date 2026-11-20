/* 非首屏资源分包；H5使用同一包内路径，快手先加载分包再读取图片。 */
(function () {
  var A = window.AIGCUtils;
  function resolve(src) {
    var path = src.split('?')[0].split('#')[0];
    if (path === 'res/Image/outgame/level-covers/level-1.jpg' ||
        path === 'res/Image/outgame/avatars/avatars-home-r12.png') return { src: path };
    var name = path.indexOf('res/Image/ingame/') === 0 ? 'battle-art' :
      /^res\/Image\/outgame\/(collection|level-covers|avatars)\//.test(path) ? 'collection-art' : null;
    return { name: name, src: name ? 'subpackages/' + name + '/' + path : path };
  }
  A.ResourcePackages = { resolve: resolve };
})();
