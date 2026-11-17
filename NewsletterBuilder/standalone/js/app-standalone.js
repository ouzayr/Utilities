/*!
 * Newsletter Builder - standalone host.
 * Saves newsletters as .newsletter.json files on this computer.
 * Edge/Chrome: real Open/Save to the same file (File System Access API).
 * Other browsers: Open = file picker, Save = download.
 */
(function () {
  'use strict';
  var APP_VERSION = '1.0.0';
  var hasFsApi = typeof window.showOpenFilePicker === 'function' && window.isSecureContext !== false;
  var fileHandle = null;
  var pickerTypes = [{ description: 'Newsletter', accept: { 'application/json': ['.json'] } }];

  function fileName(doc) { return NLCore.util.slugify(doc.title) + '.newsletter.json'; }

  function openViaInput() {
    return new Promise(function (resolve, reject) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.addEventListener('change', function () {
        var f = inp.files[0];
        if (!f) { resolve(null); return; }
        f.text().then(function (t) { resolve({ doc: JSON.parse(t), ref: null, name: f.name }); }).catch(reject);
      });
      inp.click();
    });
  }

  var provider = {
    openLabel: 'Open file…',
    saveLabel: 'Save',
    locationLabel: 'this computer',
    showImportExport: false,
    open: function () {
      if (!hasFsApi) return openViaInput();
      return window.showOpenFilePicker({ types: pickerTypes, multiple: false }).then(function (hs) {
        var hnd = hs[0];
        return hnd.getFile().then(function (f) { return f.text(); }).then(function (t) {
          fileHandle = hnd;
          return { doc: JSON.parse(t), ref: hnd.name, name: hnd.name };
        });
      });
    },
    save: function (editor, opt) {
      var doc = editor.getDoc();
      var json = NLCore.serialize(doc);
      if (!hasFsApi) {
        editor.download(fileName(doc), json, 'application/json');
        return Promise.resolve({ ref: null, name: fileName(doc) + ' (downloaded)' });
      }
      var getHandle = (!opt.saveAs && fileHandle && editor.getRef())
        ? Promise.resolve(fileHandle)
        : window.showSaveFilePicker({ suggestedName: fileName(doc), types: pickerTypes });
      return getHandle.then(function (hnd) {
        return hnd.createWritable().then(function (w) {
          return w.write(json).then(function () { return w.close(); });
        }).then(function () { fileHandle = hnd; return { ref: hnd.name, name: hnd.name }; });
      });
    }
  };

  var editor = NLEditor.create(document.getElementById('app'), {
    appName: 'Newsletter Builder',
    version: APP_VERSION,
    provider: provider,
    autosaveKey: 'nlb.standalone.autosave',
    footerNote: hasFsApi ? 'Files: saved on this computer' : 'Files: Save downloads a .json copy',
    onDirtyChange: function (d) { document.title = (d ? '● ' : '') + 'Newsletter Builder'; }
  });

  window.nlbEditor = editor;
})();
