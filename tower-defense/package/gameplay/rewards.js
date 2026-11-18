/* gameplay/rewards.js — 现状：激励奖励业务门禁；占位/H5 不发奖励。真机待验证。 */
(function () {
  var A = window.AIGCUtils;
  var S = A.State;
  var C = A.Config;
  var active = null;
  var sequence = 0;

  function toast(message) { S.toastMsg(message, 1.8); }

  function availability() {
    var config = window.KwaiAdConfig;
    var id = config && config.rewardedAdUnitId;
    if (typeof id !== 'string' || !id.trim() || /__|[<>]|placeholder/i.test(id)) {
      return '广告未配置';
    }
    // 只探测能力，平台调用仍全部走标准 KwaiAd 封装。
    if (typeof ks === 'undefined' || !ks || typeof ks.createRewardedVideoAd !== 'function' ||
        !window.KwaiAd || typeof window.KwaiAd.showRewarded !== 'function') {
      return '当前环境不支持激励广告';
    }
    return '';
  }

  function isBusy() { return !!active; }

  function release(request) {
    if (active !== request) return false;
    active = null;
    S.adBusy = false;
    if (request.timer !== null && typeof clearTimeout === 'function') clearTimeout(request.timer);
    request.timer = null;
    return true;
  }

  // 只撤销业务授权；不能替平台关闭已打开的视频。晚回调永不发奖。
  function cancel() {
    sequence++;
    if (active) release(active);
    S.adBusy = false;
  }

  function eligible(kind) {
    if (kind === 'stamina') {
      if (S.phase !== 'menu') return false;
      if (A.Profile.getStaminaSnapshot().value >= C.STAMINA_MAX) {
        toast('体力已满');
        return false;
      }
    } else {
      if (S.phase !== 'lose') return false;
      if (S.revivesUsed >= C.REVIVES_PER_RUN) {
        toast('本局复活次数已用完');
        return false;
      }
    }
    return true;
  }

  // 返回是否已发起真实广告请求，不代表奖励已到账。
  function watch(kind) {
    if (isBusy()) return false;
    if (!eligible(kind)) return false;
    var unavailable = availability();
    if (unavailable) { toast(unavailable); return false; }
    var request = {
      token: ++sequence, runToken: S.runToken, kind: kind,
      profile: A.Profile.data, uid: A.Profile.data.id, timer: null,
    };
    active = request;
    S.adBusy = true;
    S.menuStartDelay = 0;
    if (A.Input) A.Input.cancel();

    function valid() {
      return active === request && request.token === sequence &&
        A.Profile.data === request.profile && A.Profile.data.id === request.uid &&
        S.runToken === request.runToken &&
        S.phase === (kind === 'revive' ? 'lose' : 'menu');
    }
    function failed(message) {
      if (!release(request)) return;
      if (message) toast(message);
    }
    function rewarded() {
      var authorized = valid();
      if (!release(request) || !authorized) return;
      // 必须在同一阶段/对局再次校验，不信任旧回调或重复回调。
      if (kind === 'revive') {
        if (A.Battle) A.Battle.revive(request.runToken);
      } else {
        var added = A.Profile.addStamina(C.STAMINA_AD_REWARD);
        toast(added > 0 ? '体力 +' + added : '体力已满');
      }
    }
    if (typeof setTimeout === 'function') {
      request.timer = setTimeout(function () { failed('广告响应超时，请重试'); }, C.REWARDED_TIMEOUT_MS);
    }
    try {
      var result = window.KwaiAd.showRewarded(rewarded, function () {
        failed('未完整观看广告，不发放奖励');
      });
      // 部分封装返回 Promise：拒绝只解锁，resolve 本身绝不是完成观看证明。
      if (result && typeof result.then === 'function') {
        result.then(function () {}, function () { failed('广告暂不可用，请稍后重试'); });
      }
    } catch (error) {
      failed('广告暂不可用，请稍后重试');
      return false;
    }
    return true;
  }

  A.Rewards = {
    watchStamina: function () { return watch('stamina'); },
    watchRevive: function () { return watch('revive'); },
    isBusy: isBusy,
    cancel: cancel,
  };
})();
