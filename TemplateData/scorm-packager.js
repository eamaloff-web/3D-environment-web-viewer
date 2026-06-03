/**
 * SCORM Packaging & Code Generator Layer
 * Handles manifest assembly, HTML player dashboards, Mock SCORM API emulation,
 * progress tracking, and client-side zip creation using JSZip.
 */

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function generateManifest(currentModelNam, buildFiles) {
  var manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="course_annotations_\${Date.now()}" version="1.1"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd
                              http://www.w3.org/2001/XMLSchema-instance xsi.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>\${escapeXml(currentModelName)} - Annotation Viewer Course</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>Annotation Viewer Lesson</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" adlcp:scormtype="sco" href="launch.html">
      <file href="launch.html" />
      <file href="scormapi.js" />
      <file href="annotationtracking.js" />
      <file href="scormstyle.css" />
      <file href="annotations.json" />
      <file href="model.glb" />
`;

  for (var path in buildFiles) {
    manifestXml += `      <file href="\${path}" />\n`;
  }

  manifestXml += `    </resource>
  </resources>
</manifest>`;
  return manifestXml;
}

function generateScormCss() {
  return `/* ── SCORM Learner Module Layout & Typography ── */
body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #333;
  font-family: sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
}

#unity-container {
  position: relative;
  width: 960px;
  height: 600px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ccc;
  background: #231F20;
}

#unity-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

#loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #f9f9f9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: opacity 0`;
}

function generateLaunchHtml(modelName, loaderFilename, dataFilename, frameworkFilename, codeFilename, memoryFilename, symbolsFilename) {
  // We use standard string concatenation here so it safely evaluates ONLY when called,
  // preventing global scope ReferenceErrors when the script is first loaded by the browser.
  var codeParam = codeFilename ? 'codeUrl: "Build/' + codeFilename + '",' : "";
  var memoryParam = memoryFilename ? 'memoryUrl: "Build/' + memoryFilename + '",' : "";
  var symbolsParam = symbolsFilename ? 'symbolsUrl: "Build/' + symbolsFilename + '",' : "";

  return `<!DOCTYPE html>
<html lang="en-us">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Annotation Viewer - ` + escapeXml(modelName) + `</title>
  <link rel="stylesheet" href="scormstyle.css">
</head>
<body>

  <div id="unity-container">
    <canvas id="unity-canvas" tabindex="-1"></canvas>
    
    <div id="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-title">Loading 3D Experience</div>
      <div class="loading-subtitle">Initializing WebGL Engine...</div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" id="progress-fill"></div>
      </div>
    </div>
  </div>

  <div id="scorm-navigation-bar">
    <button id="scorm-prev-btn" onclick="scormGoPrev()" disabled>← Previous</button>
    <span id="scorm-progress-label">Annotation 0 of 0</span>
    <button id="scorm-next-btn" onclick="scormGoNext()" disabled>Next →</button>
    <button id="scorm-finish-btn" onclick="scormFinish()" style="display: none;">Finish Lesson</button>
  </div>

  <div id="unity-warning"></div>

  <script src="scormapi.js"></script>
  <script src="annotationtracking.js"></script>
  <script src="Build/` + loaderFilename + `"></script>

  <script>
    // Initialize SCORM
    try {
      var initResult = SCORM_API.Init();
      console.log("[SCORM] Initialize result:", initResult);
    } catch(e) {
      console.error("[SCORM] Error initializing:", e);
    }

    // Webpage Button actions
    function scormGoPrev() {
      if (window.unityInstance) {
        window.unityInstance.SendMessage("SCORMController", "GoToPrevious", "");
      }
    }
    function scormGoNext() {
      if (window.unityInstance) {
        window.unityInstance.SendMessage("SCORMController", "GoToNext", "");
      }
    }
    function scormFinish() {
      if (window.unityInstance) {
        window.unityInstance.SendMessage("SCORMController", "FinishLesson", "");
      }
      alert("Lesson Finished! Your progress has been successfully saved to the LMS.");
    }

    // Handle Unity PInvoke State Changes
    window.onSCORMStateChanged = function(currentIndex, totalCount, isFirst, isLast, currentViewed, allViewed) {
      console.log("[SCORM Webpage] State updated: index=" + currentIndex + ", total=" + totalCount + ", first=" + isFirst + ", last=" + isLast + ", currentViewed=" + currentViewed + ", allViewed=" + allViewed);
      
      var prevBtn = document.querySelector("#scorm-prev-btn");
      var nextBtn = document.querySelector("#scorm-next-btn");
      var finishBtn = document.querySelector("#scorm-finish-btn");
      var label = document.querySelector("#scorm-progress-label");

      if (label) {
        label.textContent = "Annotation " + (currentIndex + 1) + " of " + totalCount;
      }
      if (prevBtn) {
        prevBtn.disabled = !!isFirst;
      }
      if (nextBtn) {
        nextBtn.disabled = !currentViewed || !!isLast;
      }
      if (finishBtn) {
        finishBtn.style.display = allViewed ? "block" : "none";
      }
    };

    var canvas = document.querySelector("#unity-canvas");
    var config = {
      arguments: [],
      dataUrl: "Build/` + dataFilename + `",
      frameworkUrl: "Build/` + frameworkFilename + `",
      ` + codeParam + `
      ` + memoryParam + `
      ` + symbolsParam + `
      streamingAssetsUrl: "StreamingAssets",
      companyName: "Frappe",
      productName: "` + escapeXml(modelName) + `",
      productVersion: "1.0",
      showBanner: function(msg, type) {
        var warning = document.querySelector("#unity-warning");
        if(warning) {
          warning.textContent = msg;
          warning.style.display = "block";
          if (type !== "error") {
            setTimeout(function() { warning.style.display = "none"; }, 5000);
          }
        }
      }
    };

    var progressFill = document.querySelector("#progress-fill");
    
    createUnityInstance(canvas, config, (progress) => {
      if(progressFill) progressFill.style.width = (100 * progress) + "%";
    }).then((unityInstance) => {
      console.log("[SCORM] Unity instance created successfully.");
      var loaderOverlay = document.querySelector("#loading-overlay");
      if(loaderOverlay) {
         loaderOverlay.style.opacity = "0";
         setTimeout(() => { loaderOverlay.style.display = "none"; }, 500);
      }

      // Tell Unity we are in SCORM mode
      unityInstance.SendMessage("SCORMController", "SetSCORMMode", "");

      // Send the absolute URL of the GLB model so UnityWebRequest / GLTFast can resolve it
      var modelAbsoluteUrl = new URL("model.glb", window.location.href).href;
      unityInstance.SendMessage("SCORMController", "ReceiveModelPath", modelAbsoluteUrl);

      // Load and send annotations.json
      fetch("annotations.json")
        .then(response => response.json())
        .then(data => {
          var payload = JSON.stringify({
            modelName: "` + escapeXml(modelName) + `",
            allAnnotations: data
          });
          unityInstance.SendMessage("SCORMController", "ReceiveAnnotations", payload);
        })
        .catch(err => {
          console.error("[SCORM] Failed to load annotations.json:", err);
        });

      window.unityInstance = unityInstance;

    }).catch((message) => {
      alert("Error starting the WebGL viewer: " + message);
    });
  </script>
</body>
</html>`;
}

function generateScormApi() {
  return `/**
 * SCORM 1.2 Communication & Mock Layer
 */
(function(window) {
  var findAPITries = 0;
  var maxAPITries = 500;
  var apiHandle = null;

  function findAPI(win) {
    while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
      findAPITries++;
      if (findAPITries > maxAPITries) {
        return null;
      }
      win = win.parent;
    }
    return win.API;
  }

  function getAPI() {
    var theAPI = findAPI(window);
    if ((theAPI == null) && (window.opener != null) && (typeof(window.opener) != "undefined")) {
      theAPI = findAPI(window.opener);
    }
    if (theAPI == null) {
      console.log("[SCORM] LMS API not found. Initiating Mock SCORM 1.2 Layer.");
      theAPI = createMockAPI();
    }
    return theAPI;
  }

  function createMockAPI() {
    var store = {
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.student_id": "mock_learner",
      "cmi.core.student_name": "Mock Learner",
      "cmi.core.score.raw": "0",
      "cmi.core.score.min": "0",
      "cmi.core.score.max": "100"
    };
    
    return {
      LMSInitialize: function(param) {
        console.log("[SCORM Mock] LMSInitialize called with: '" + param + "'");
        return "true";
      },
      LMSFinish: function(param) {
        console.log("[SCORM Mock] LMSFinish called with: '" + param + "'");
        return "true";
      },
      LMSGetValue: function(element) {
        var value = store[element] || "";
        console.log("[SCORM Mock] LMSGetValue('" + element + "') -> '" + value + "'");
        return value;
      },
      LMSSetValue: function(element, value) {
        store[element] = String(value);
        console.log("[SCORM Mock] LMSSetValue('" + element + "', '" + value + "') -> true");
        return "true";
      },
      LMSCommit: function(param) {
        console.log("[SCORM Mock] LMSCommit called with: '" + param + "'");
        return "true";
      },
      LMSGetLastError: function() {
        return "0";
      },
      LMSGetErrorString: function(errorCode) {
        return "No error";
      },
      LMSGetDiagnostic: function(errorCode) {
        return "Mock API diagnostic - OK";
      }
    };
  }

  var activeAPI = getAPI();

  window.SCORM_API = {
    Init: function() {
      return activeAPI.LMSInitialize("");
    },
    GetValue: function(element) {
      return activeAPI.GetValue ? activeAPI.GetValue(element) : activeAPI.LMSGetValue(element);
    },
    SetValue: function(element, value) {
      return activeAPI.SetValue ? activeAPI.SetValue(element, value) : activeAPI.LMSSetValue(element, value);
    },
    Commit: function() {
      return activeAPI.Commit ? activeAPI.Commit("") : activeAPI.LMSCommit("");
    },
    Finish: function() {
      return activeAPI.Finish ? activeAPI.Finish("") : activeAPI.LMSFinish("");
    },
    GetRawAPI: function() {
      return activeAPI;
    }
  };
})(window);`;
}

function generateAnnotationTracking() {
  return `/**
 * SCORM Annotation Tracking & Progression Layer
 */
(function(window) {
  var totalAnnotations = 0;
  var viewedAnnotations = new Set();

  fetch("annotations.json")
    .then(response => response.json())
    .then(data => {
      totalAnnotations = data.length;
      console.log("[SCORM Tracker] Total annotations to track: " + totalAnnotations);

      var currentStatus = SCORM_API.GetValue("cmi.core.lesson_status");
      if (currentStatus !== "completed" && currentStatus !== "passed") {
        SCORM_API.SetValue("cmi.core.lesson_status", "incomplete");
        SCORM_API.Commit();
      }
    })
    .catch(err => {
      console.error("[SCORM Tracker] Failed to load annotations.json during init:", err);
    });

  window.onAnnotationViewed = function(annotationId) {
    if (viewedAnnotations.has(annotationId)) {
      console.log("[SCORM Tracker] Annotation already viewed: " + annotationId);
      return;
    }

    viewedAnnotations.add(annotationId);
    console.log("[SCORM Tracker] Viewing annotation: " + annotationId + " (" + viewedAnnotations.size + " of " + totalAnnotations + ")");

    var percent = Math.min(100, Math.round((viewedAnnotations.size / totalAnnotations) * 100));
    SCORM_API.SetValue("cmi.core.score.raw", percent);

    if (viewedAnnotations.size >= totalAnnotations) {
      console.log("[SCORM Tracker] All annotations viewed! Completing course.");
      SCORM_API.SetValue("cmi.core.lesson_status", "completed");
      SCORM_API.Commit();
    } else {
      SCORM_API.Commit();
    }
  };

  window.addEventListener("beforeunload", function() {
    SCORM_API.Finish();
  });
  window.addEventListener("unload", function() {
    SCORM_API.Finish();
  });
})(window);`;
}

function showProgressOverlay(title, message) {
  var overlay = document.querySelector("#scorm-progress-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "scorm-progress-overlay";
    overlay.innerHTML = `
      <div id="scorm-progress-overlay-card">
        <div class="scorm-spinner"></div>
        <div id="scorm-progress-title">Preparing SCORM...</div>
        <div id="scorm-progress-msg">Starting...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.offsetHeight; // force reflow
  }
  overlay.style.display = "flex";
  overlay.style.opacity = "1";
  updateProgressOverlay(title, message);
}

function updateProgressOverlay(title, msg) {
  var titleEl = document.querySelector("#scorm-progress-title");
  var msgEl = document.querySelector("#scorm-progress-msg");
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
}

function hideProgressOverlay() {
  var overlay = document.querySelector("#scorm-progress-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(function () {
      overlay.style.display = "none";
    }, 300);
  }
}

function downloadSCORMPackage() {
  if (allAnnotations.length === 0) {
    alert("No annotations saved! Please create and save at least one annotation first.");
    return;
  }
  if (!window.currentModelName || !window.currentModelFileUrl) {
    alert("No model loaded! Please upload a GLB model first.");
    return;
  }

  showProgressOverlay("Assembling Package", "Initializing zip generator...");

  var sortedAnnotations = [...allAnnotations].sort((a, b) => a.order - b.order);

  function getFilename(url) {
    if (!url) return null;
    if (url.startsWith("data:") || url.startsWith("blob:")) return "media-file";
    var parts = url.split("/");
    return parts[parts.length - 1];
  }

  var loaderName = getFilename(loaderUrl);
  var dataName = getFilename(config.dataUrl);
  var frameworkName = getFilename(config.frameworkUrl);
  var codeName = getFilename(config.codeUrl);
  var memoryName = getFilename(config.memoryUrl);
  var symbolsName = getFilename(config.symbolsUrl);

  var fetchMap = {};
  if (loaderUrl) fetchMap["Build/" + loaderName] = loaderUrl;
  if (config.dataUrl) fetchMap["Build/" + dataName] = config.dataUrl;
  if (config.frameworkUrl) fetchMap["Build/" + frameworkName] = config.frameworkUrl;
  if (config.codeUrl) fetchMap["Build/" + codeName] = config.codeUrl;
  if (config.memoryUrl) fetchMap["Build/" + memoryName] = config.memoryUrl;
  if (config.symbolsUrl) fetchMap["Build/" + symbolsName] = config.symbolsUrl;

  var mediaFilesMap = {};
  sortedAnnotations.forEach(function(anno) {
    if (anno.mediaFiles) {
      anno.mediaFiles.forEach(function(mf) {
        mediaFilesMap[mf.name] = mf.dataUrl;
      });
    }
  });

  var totalFiles = Object.keys(fetchMap).length + 1 + Object.keys(mediaFilesMap).length;
  var loadedCount = 0;
  var fileBlobs = {};

  function fetchFile(path, url) {
    var displayName = path.startsWith("media/") ? path : getFilename(url);
    updateProgressOverlay("Downloading Assets", "Fetching " + displayName + " (" + (loadedCount + 1) + " of " + totalFiles + ")...");
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error("HTTP error! Status: " + response.status + " while loading " + url);
        }
        return response.blob();
      })
      .then(blob => {
        fileBlobs[path] = blob;
        loadedCount++;
      });
  }

  var sequence = Promise.resolve();
  Object.keys(fetchMap).forEach(path => {
    sequence = sequence.then(() => fetchFile(path, fetchMap[path]));
  });

  Object.keys(mediaFilesMap).forEach(name => {
    sequence = sequence.then(() => fetchFile("media/" + name, mediaFilesMap[name]));
  });

  sequence = sequence.then(() => {
    updateProgressOverlay("Extracting 3D Model", "Converting local GLB asset...");
    return fetch(window.currentModelFileUrl)
      .then(res => res.blob())
      .then(blob => {
        fileBlobs["model.glb"] = blob;
        loadedCount++;
      });
  });

  sequence.then(() => {
    updateProgressOverlay("Generating Package", "Compressing files into SCORM structure...");

    var zip = new JSZip();

    var buildFilesMap = {};
    Object.keys(fetchMap).forEach(path => {
      buildFilesMap[path] = true;
    });
    Object.keys(mediaFilesMap).forEach(name => {
      buildFilesMap["media/" + name] = true;
    });

    var annotationsForScorm = sortedAnnotations.map(function(anno) {
      var clone = Object.assign({}, anno);
      if (clone.mediaFiles && clone.mediaFiles.length > 0) {
        clone.imageUrls = clone.mediaFiles.map(function(mf) { return "media/" + mf.name; });
        clone.mediaUrl = "media/" + clone.mediaFiles[0].name;
      } else {
        clone.imageUrls = clone.imageUrls || [];
        clone.mediaUrl = clone.mediaUrl || "";
      }
      delete clone.mediaFiles;
      return clone;
    });

    zip.file("imsmanifest.xml", generateManifest(window.currentModelName, buildFilesMap));
    zip.file("launch.html", generateLaunchHtml(window.currentModelName, loaderName, dataName, frameworkName, codeName, memoryName, symbolsName));
    zip.file("scormapi.js", generateScormApi());
    zip.file("annotationtracking.js", generateAnnotationTracking());
    zip.file("scormstyle.css", generateScormCss());
    zip.file("annotations.json", JSON.stringify(annotationsForScorm, null, 2));

    zip.file("model.glb", fileBlobs["model.glb"]);
    Object.keys(fetchMap).forEach(path => {
      zip.file(path, fileBlobs[path]);
    });
    Object.keys(mediaFilesMap).forEach(name => {
      zip.file("media/" + name, fileBlobs["media/" + name]);
    });

    return zip.generateAsync({ type: "blob" }).then(content => {
      updateProgressOverlay("Complete!", "Saving archive to download folder...");

      var dlAnchorElem = document.createElement('a');
      var url = URL.createObjectURL(content);
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", window.currentModelName + "_scorm.zip");
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();

      setTimeout(() => {
        document.body.removeChild(dlAnchorElem);
        URL.revokeObjectURL(url);
        hideProgressOverlay();
      }, 1000);
    });
  })
    .catch(error => {
      hideProgressOverlay();
      alert("SCORM Packaging Failed: " + error.message);
      console.error("[SCORM Packaging Error]", error);
    });
}
