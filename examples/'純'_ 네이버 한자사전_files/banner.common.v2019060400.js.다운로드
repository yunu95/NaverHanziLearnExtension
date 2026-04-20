(function () {
    var protocol = (window.location.protocol == "https:") ? "https:" : "http:";
    var Banner = window.Banner || {};
    window.Banner = Banner;
    Banner.servicePageCode = undefined;
    var NCLICK_DOMAIN = "alpha-cc.naver.com";
    var nclk_ct = 0;
    var _CDN_DOMAIN = "";
    var _path = "";
    var _isRendered = false;
    var _isRerendering = false;

    // polyfill
    if (!Array.isArray) {
        Array.isArray = function (arg) {
            return Object.prototype.toString.call(arg) === '[object Array]';
        };
    }

    /**
     * @param options {serviceCode, langCode, envCode, servicePageCode, keyword, isRerendering}
     * @param callback
     */
    Banner.start = function (options, callback) {
        if (!Banner.move) {
            console.log('banner nclcick lib file is required.');
            return false;
        }
        if (!options.serviceCode || !options.langCode) {
            console.log('serviceCode and langCode are required.');
            return false;
        }
        if (!options.envCode) {
            console.log('envCode is required.');
            return false;
        }
        if (!document) {
            console.log('call after dom loaded');
            return false;
        }
        // location type : L, R, N, F
        Banner.L = {};
        Banner.C = {};
        Banner.NKC = {};
        Banner.K = {};
        Banner.KC = {};

        // set options
        Banner.servicePageCode = options.servicePageCode;
        _isRerendering = options.isRerendering;
        _CDN_DOMAIN = _getUrl(options.envCode);
        NCLICK_DOMAIN = Number(options.envCode) === 2 ? "cc.naver.com" : "alpha-cc.naver.com";
        _path = _CDN_DOMAIN + options.serviceCode + "." + options.langCode + "/";

        // total call step : json -> css -> js -> render
        // load json
        _loadJson(function (data) {
            // load static files ( handled file type : js, css )
            _loadStaticFiles(options, data, function () {
                // rendering
                if (!_isRerendering && _isRendered) {
                    console.log('banner is already rendered, see the re-rendering option.');
                    return false;
                } else {
                    _rendering(options);
                    if (!!callback) {
                        callback();
                    }
                }
            });
        });
    };

    /**
     * @param code
     */
    var _getUrl = function (code) {
        var codeNum = Number(code);
        switch (codeNum) {
            case 1:
                return "https://ssl.pstatic.net/dicimg/banner/script/stg/";
            case 2:
                return "https://ssl.pstatic.net/dicimg/banner/script/real/";
            default:
                return "https://ssl.pstatic.net/dicimg/banner/script/real/";
        }
    };

    /**
     * @param callback
     */
    var _loadJson = function (callback) {
        // application/json
        var xhr = new XMLHttpRequest();
        xhr.addEventListener("load", function () {
            if (this.status === 200) {
                callback(JSON.parse(this.response));
            }
        });
        xhr.open("GET", _path + "page.json");
        xhr.send();
    };

    /**
     * @param options {serviceCode, langCode, keyword, isRerendering}
     * @param pageMetaInfo {files : [{type, name, timeStamp}]}
     * @param callback
     */
    var _loadStaticFiles = function (options, pageMetaInfo, callback) {
        var commonCss = (!!pageMetaInfo.common_css) && (!!pageMetaInfo.common_css.fileName) && (!!pageMetaInfo.common_css.cdnUrl);
        var fetchSize = pageMetaInfo.files.length;
        if (commonCss) {
            fetchSize++;
        }
        var fetchObj = {
            fetchSize: fetchSize,
            eachCallback: function () {
                this.fetchSize--;
                if (this.fetchSize == 0) this.finalCallback();
            },
            finalCallback: function () {
                callback();
            }
        };
        if (commonCss) {
            _loadCss(pageMetaInfo.common_css.cdnUrl + pageMetaInfo.common_css.fileName, function () {
                fetchObj.eachCallback();
            });
        }
        for (var key in pageMetaInfo.files) {
            if (pageMetaInfo.files[key].type == 'js') {
                _loadJs(_path + pageMetaInfo.files[key].name + ".js?timestamp=" + pageMetaInfo.files[key].timeStamp, function () {
                    fetchObj.eachCallback();
                });
            } else if (pageMetaInfo.files[key].type == 'css') {
                _loadCss(_path + pageMetaInfo.files[key].name + ".css?timestamp=" + pageMetaInfo.files[key].timeStamp, function () {
                    fetchObj.eachCallback();
                });
            }
        }
    };

    /**
     * @param url
     * @param callback
     */
    var _loadJs = function (url, callback) {
        // text/javascript
        var script = document.createElement('script');
        script.type = "text/javascript";

        // IE
        if (script.readyState) {
            if (script.readyState == 'loaded' || script.readyState == 'complete') {
                script.onreadystatchange = null;
                callback();
            }
        } else {
            script.onload = function () {
                callback();
            }
        }

        script.src = url;
        document.getElementsByTagName('head')[0].appendChild(script);
    };

    /**
     * @param url
     * @param callback
     */
    var _loadCss = function (url, callback) {
        // text/css
        var link = document.createElement('link');
        link.rel = "stylesheet";
        link.type = "text/css";

        var fi = setInterval(function () {
            try {
                if (link.sheet) {
                    callback();
                    clearInterval(fi);
                }
            } catch (e) {
            }
        }, 10);

        link.href = url;
        document.getElementsByTagName('head')[0].appendChild(link);
    };

    /**
     * @param locationCode
     * @returns {*}
     */
    var _getLocation = function (locationCode) {
        if (!Banner.L[locationCode]) {
            return false;
        }
        return Banner.L[locationCode];
    };

    /**
     * @param locationCode
     * @param keyword
     * @returns {*}
     */
    var _getContent = function (locationCode, keyword) {
        var contentListObj = {};

        // 키워드 입력된 경우
        if (!!keyword) {
            if (!!Banner.K[locationCode]) {
                var contentIdList = Banner.K[locationCode][keyword];
                if (Array.isArray(contentIdList)) {
                    var listSize = contentIdList.length;
                    for (var z = 0; z < listSize; z++) {
                        var contentId = contentIdList[z];
                        if (Banner.KC[contentId]) {
                            contentListObj[contentId] = Banner.KC[contentId];
                        }
                    }
                }
            }
        }

        var contentSize = Object.keys(contentListObj).length;
        // 키워드 입력이 없거나 키워드와 매칭되는 콘텐츠가 없는 경우
        if (contentSize === 0) {
            contentListObj = Banner.NKC[locationCode];
            contentListObj = contentListObj ? contentListObj : {};
        }

        return contentListObj;
    };

    /**
     * @param options {serviceCode, langCode, keyword, isRerendering}
     */
    var _rendering = function (options) {
        //select dict banner tags
        var selectedParentTags = document.getElementsByTagName('dictbanner');

        //append banner content by location code
        var size = selectedParentTags.length;
        for (var i = 0; i < size; i++) {
            var parentTag = selectedParentTags[i];
            //remove dict banner tag inner content
            while (parentTag.firstChild) {
                parentTag.removeChild(parentTag.firstChild);
            }

            var locationCode = parentTag.getAttribute('data-location-code');
            if (locationCode) {
                var locationInfo = _getLocation(locationCode);
                if (!!locationInfo) {
                    var content = "";
                    var contentListObj = _getContent(locationCode, locationInfo.bannerType != 'N' ? options.keyword : undefined);
                    if (locationInfo.bannerType == 'R') {
                        // random banner
                        var sumWeight = 0;
                        for (var ci in contentListObj) {
                            sumWeight += contentListObj[ci].rateWeight;
                            contentListObj[ci].tempId = sumWeight;
                        }
                        var randomNumber = Math.floor((Math.random() * sumWeight) + 1);
                        for (var cj in contentListObj) {
                            if (randomNumber <= contentListObj[cj].tempId) {
                                content = contentListObj[cj].dom;
                                break;
                            }
                        }
                    } else if (locationInfo.bannerType == 'F') {
                        // flicking 배너 미처리
                    } else {
                        // others
                        for (var cz in contentListObj) {
                            content += contentListObj[cz].dom;
                        }
                    }
                    parentTag.innerHTML = content;
                } else {
                    console.log('input valid location code');
                }
            }
        }
        _isRendered = true;
    };

    var _nclk_l = function (o, tU) {
        var l, tN, tH;
        // o.href로 HTML Spec에 따라 href 속성을 가진 엘리먼트인지? 형식에 맞는 링크인지? 판별이 가능하나, IE에서 img엘리먼트만 예외로 src값을 반환하고 있음.
        // IE대응을 위해 후순위로 getAttriute 조건문 추가함.
        if (o && o.href && o.getAttribute("href")) {
            tN = o.tagName.toLowerCase();
            tH = o.href.toLowerCase();
            if (tH && tH.indexOf(protocol + "//" + NCLICK_DOMAIN) == 0) {	// href is cc.naver.com ...
                l = o.href;
            } else if (tH && tH.indexOf(protocol + "//" + NCLICK_DOMAIN) != 0 && tN && tN != "img") {
                l = tU + "&u=" + encodeURIComponent(o.href);	// append target url
            }
            return l;
        }
        return tU + "&u=about%3Ablank";		// no tareget url - default
    };

    var _send = function (clickId, nsc, event) {
        var target = event && event.target;
        var l = protocol + "//" + NCLICK_DOMAIN + "/cc?a=" + clickId + "&nsc=" + nsc + "&m=0";
        l = _nclk_l(target, l);
        if (nclk_ct > 0) {
            var t = new Date().getTime();
            // avoid image cache
            l += "&nt=" + t;
        }
        var o = new Image();
        o.onload = function () {
            o.onload = null;
        };
        o.onerror = function () {
            o.onerror = null;
        };
        o.src = l;
        nclk_ct++;
        var G = navigator.userAgent.toLowerCase();
        var CH = (G.indexOf("chrome") != -1 ? true : false);
        var SA = (G.indexOf("safari") != -1 ? true : false);
        if (!CH && SA) {
            var c = new Date();
            var R = c;
            while ((R.getTime() - c.getTime()) < 100) {
                R = new Date()
            }
        }
    };

    Banner.move = function (context, event) {
        var nClickCode = context.getAttribute("data-click-code");
        var fixedServicePageCode = context.getAttribute("data-service-page-code");
        var nsc = undefined;
        if (!fixedServicePageCode) {
            nsc = Banner.servicePageCode || window.nsc;
        } else {
            nsc = fixedServicePageCode
        }
        if (!!nsc && !!nClickCode) {
            _send(nClickCode, nsc, event);
        }
    };
})();