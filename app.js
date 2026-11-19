/* ==========================================================================
   Hosford Essay Builder — Application Controller (app.js)
   Manages wizard state, localStorage auto-save, dynamic body paragraphs,
   repeatable evidence chunks, confirmation modal, and live MLA rendering.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'hosford_essay_builder_v1';
  var SCHEMA_VERSION = 2;
  var DEFAULT_BODY_PARAGRAPHS = 3;
  var Export = window.HosfordExport;

  var idCounter = 1;
  function makeId(prefix) {
    idCounter += 1;
    return prefix + '-' + Date.now() + '-' + idCounter;
  }

  function createEmptyChunk() {
    return {
      id: makeId('ev'),
      quote: '',
      summary: '',
      explanation: ''
    };
  }

  function createEmptyBodyParagraph() {
    return {
      id: makeId('bp'),
      topicSentence: '',
      evidenceChunks: [createEmptyChunk()],
      concludingSentence: ''
    };
  }

  function createEmptyReview() {
    var checklist = {};
    for (var i = 0; i < Export.CHECKLIST_ITEMS.length; i++) {
      checklist[Export.CHECKLIST_ITEMS[i].id] = false;
    }
    var rubric = {};
    for (var j = 0; j < Export.RUBRIC_TRAITS.length; j++) {
      rubric[Export.RUBRIC_TRAITS[j].id] = '';
    }
    return {
      checklist: checklist,
      rubric: rubric
    };
  }

  function createDefaultState() {
    var defaultBodies = [];
    for (var i = 0; i < DEFAULT_BODY_PARAGRAPHS; i++) {
      defaultBodies.push(createEmptyBodyParagraph());
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      currentPageIndex: 0,
      setup: {
        studentName: '',
        teacherName: '',
        classPeriod: '',
        date: '',
        title: ''
      },
      intro: {
        hook: '',
        context: '',
        claim: ''
      },
      bodyParagraphs: defaultBodies,
      conclusion: {
        restatedClaim: '',
        summaryOfBody: '',
        whyItMatters: ''
      },
      review: createEmptyReview()
    };
  }

  function normalizeState(raw) {
    var base = createDefaultState();
    if (!raw || typeof raw !== 'object') return base;

    if (raw.setup && typeof raw.setup === 'object') {
      base.setup.studentName = typeof raw.setup.studentName === 'string' ? raw.setup.studentName : '';
      base.setup.teacherName = typeof raw.setup.teacherName === 'string' ? raw.setup.teacherName : '';
      base.setup.classPeriod = typeof raw.setup.classPeriod === 'string' ? raw.setup.classPeriod : '';
      base.setup.date = typeof raw.setup.date === 'string' ? raw.setup.date : '';
      base.setup.title = typeof raw.setup.title === 'string' ? raw.setup.title : '';
    }

    if (raw.intro && typeof raw.intro === 'object') {
      base.intro.hook = typeof raw.intro.hook === 'string' ? raw.intro.hook : '';
      base.intro.context = typeof raw.intro.context === 'string' ? raw.intro.context : '';
      base.intro.claim = typeof raw.intro.claim === 'string' ? raw.intro.claim : '';
    }

    var oldBodyCount = 0;
    if (Array.isArray(raw.bodyParagraphs) && raw.bodyParagraphs.length > 0) {
      base.bodyParagraphs = raw.bodyParagraphs.map(function (bp) {
        var chunks = [];
        if (bp && Array.isArray(bp.evidenceChunks) && bp.evidenceChunks.length > 0) {
          chunks = bp.evidenceChunks.map(function (ch) {
            return {
              id: (ch && ch.id) ? String(ch.id) : makeId('ev'),
              quote: (ch && typeof ch.quote === 'string') ? ch.quote : '',
              summary: (ch && typeof ch.summary === 'string') ? ch.summary : '',
              explanation: (ch && typeof ch.explanation === 'string') ? ch.explanation : ''
            };
          });
        } else {
          chunks = [createEmptyChunk()];
        }

        return {
          id: (bp && bp.id) ? String(bp.id) : makeId('bp'),
          topicSentence: (bp && typeof bp.topicSentence === 'string') ? bp.topicSentence : '',
          evidenceChunks: chunks,
          concludingSentence: (bp && typeof bp.concludingSentence === 'string') ? bp.concludingSentence : ''
        };
      });
      oldBodyCount = base.bodyParagraphs.length;
    }

    // Migrate v1 states (which started with 1 body paragraph) to include 3 body paragraphs by default
    var migratedAdded = 0;
    if ((raw.schemaVersion || 1) < SCHEMA_VERSION) {
      while (base.bodyParagraphs.length < DEFAULT_BODY_PARAGRAPHS) {
        base.bodyParagraphs.push(createEmptyBodyParagraph());
        migratedAdded += 1;
      }
    }
    base.schemaVersion = SCHEMA_VERSION;

    if (raw.conclusion && typeof raw.conclusion === 'object') {
      base.conclusion.restatedClaim = typeof raw.conclusion.restatedClaim === 'string' ? raw.conclusion.restatedClaim : '';
      base.conclusion.summaryOfBody = typeof raw.conclusion.summaryOfBody === 'string' ? raw.conclusion.summaryOfBody : '';
      base.conclusion.whyItMatters = typeof raw.conclusion.whyItMatters === 'string' ? raw.conclusion.whyItMatters : '';
    }

    if (raw.review && typeof raw.review === 'object') {
      if (raw.review.checklist && typeof raw.review.checklist === 'object') {
        for (var ci = 0; ci < Export.CHECKLIST_ITEMS.length; ci++) {
          var cid = Export.CHECKLIST_ITEMS[ci].id;
          base.review.checklist[cid] = Boolean(raw.review.checklist[cid]);
        }
      }
      if (raw.review.rubric && typeof raw.review.rubric === 'object') {
        var validCodes = { DP: true, CP: true, PR: true, HP: true };
        for (var ri = 0; ri < Export.RUBRIC_TRAITS.length; ri++) {
          var rid = Export.RUBRIC_TRAITS[ri].id;
          var val = raw.review.rubric[rid];
          base.review.rubric[rid] = validCodes[val] ? val : '';
        }
      }
    }

    var totalPages = 5 + base.bodyParagraphs.length;
    if (typeof raw.currentPageIndex === 'number' && raw.currentPageIndex >= 0) {
      var adjustedIndex = raw.currentPageIndex;
      if (migratedAdded > 0 && oldBodyCount > 0 && raw.currentPageIndex >= 2 + oldBodyCount) {
        adjustedIndex += migratedAdded;
      }
      base.currentPageIndex = Math.min(adjustedIndex, totalPages - 1);
    }

    return base;
  }

  function loadState() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return createDefaultState();
      var parsed = JSON.parse(saved);
      var normalized = normalizeState(parsed);
      if ((parsed && parsed.schemaVersion) !== SCHEMA_VERSION) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      return createDefaultState();
    }
  }

  var state = loadState();
  var saveTimer = null;
  var toastTimer = null;
  var pendingConfirmAction = null;

  // DOM References
  var elPageContent = document.getElementById('page-content');
  var elMainContainer = document.getElementById('wizard-stage');
  var elStepPills = document.getElementById('step-pills');
  var elProgressFill = document.getElementById('progress-fill');
  var elProgressTrack = document.getElementById('progress-track');
  var elProgressStepLabel = document.getElementById('progress-step-label');
  var elWordCountBadge = document.getElementById('word-count-badge');
  var elSaveIndicator = document.getElementById('save-indicator');
  var elSaveIndicatorText = document.getElementById('save-indicator-text');
  var elBtnClearEssay = document.getElementById('btn-clear-essay');
  var elConfirmDialog = document.getElementById('confirm-dialog');
  var elConfirmTitle = document.getElementById('confirm-title');
  var elConfirmMessage = document.getElementById('confirm-message');
  var elConfirmOk = document.getElementById('confirm-ok');
  var elConfirmCancel = document.getElementById('confirm-cancel');
  var elToast = document.getElementById('toast');

  /* ========================================================================
     Persistence & Feedback Helpers
     ======================================================================== */
  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      elSaveIndicator.classList.add('is-saving');
      elSaveIndicatorText.textContent = 'Saving...';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        elSaveIndicator.classList.remove('is-saving');
        elSaveIndicatorText.textContent = 'Auto-saved';
      }, 450);
    } catch (err) {
      elSaveIndicatorText.textContent = 'Save unavailable';
    }
  }

  function showToast(message) {
    elToast.textContent = message;
    elToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      elToast.hidden = true;
    }, 3000);
  }

  function openConfirmModal(options) {
    elConfirmTitle.textContent = options.title || 'Confirm Action';
    elConfirmMessage.textContent = options.message || 'Are you sure?';
    elConfirmOk.textContent = options.confirmText || 'Confirm';
    pendingConfirmAction = options.onConfirm || null;

    if (typeof elConfirmDialog.showModal === 'function') {
      elConfirmDialog.showModal();
    } else if (window.confirm(options.message)) {
      if (pendingConfirmAction) pendingConfirmAction();
      pendingConfirmAction = null;
    }
  }

  function closeConfirmModal() {
    pendingConfirmAction = null;
    if (elConfirmDialog.open) {
      elConfirmDialog.close();
    }
  }

  elConfirmCancel.addEventListener('click', closeConfirmModal);
  elConfirmDialog.addEventListener('cancel', function () {
    pendingConfirmAction = null;
  });
  elConfirmOk.addEventListener('click', function () {
    var action = pendingConfirmAction;
    closeConfirmModal();
    if (typeof action === 'function') {
      action();
    }
  });

  elBtnClearEssay.addEventListener('click', function () {
    openConfirmModal({
      title: 'Clear & Start a New Essay?',
      message:
        'This will permanently erase everything you have written on every page and reset Hosford Essay Builder to a blank essay. Make sure you have copied or saved your work first.',
      confirmText: 'Yes, Clear Everything',
      onConfirm: function () {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          // Ignore storage errors
        }
        state = createDefaultState();
        saveState();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('Cleared! Ready for a brand new essay.');
      }
    });
  });

  /* ========================================================================
     Wizard Structure & Page Metadata
     ======================================================================== */
  function getPages() {
    var pages = [
      {
        type: 'setup',
        shortLabel: 'MLA Setup',
        title: 'MLA Header & Setup'
      },
      {
        type: 'intro',
        shortLabel: 'Introduction',
        title: 'Introduction Paragraph'
      }
    ];

    for (var i = 0; i < state.bodyParagraphs.length; i++) {
      pages.push({
        type: 'body',
        bodyIndex: i,
        shortLabel: 'Body ' + (i + 1),
        title: 'Body Paragraph ' + (i + 1)
      });
    }

    pages.push({
      type: 'conclusion',
      shortLabel: 'Conclusion',
      title: 'Conclusion Paragraph'
    });

    pages.push({
      type: 'final',
      shortLabel: 'Final MLA Essay',
      title: 'Live MLA Formatted Essay'
    });

    pages.push({
      type: 'review',
      shortLabel: 'Review & Rubric',
      title: 'Review & Self-Assessment Rubric'
    });

    return pages;
  }

  function isPageCompleted(page) {
    if (page.type === 'setup') {
      var s = state.setup;
      return Boolean(
        s.studentName.trim() ||
        s.teacherName.trim() ||
        s.classPeriod.trim() ||
        s.date.trim() ||
        s.title.trim()
      );
    }
    if (page.type === 'intro') {
      var intro = state.intro;
      return Boolean(intro.hook.trim() || intro.context.trim() || intro.claim.trim());
    }
    if (page.type === 'body') {
      var bp = state.bodyParagraphs[page.bodyIndex];
      if (!bp) return false;
      if (bp.topicSentence.trim() || bp.concludingSentence.trim()) return true;
      for (var i = 0; i < bp.evidenceChunks.length; i++) {
        var ch = bp.evidenceChunks[i];
        if (ch.quote.trim() || ch.summary.trim() || ch.explanation.trim()) return true;
      }
      return false;
    }
    if (page.type === 'conclusion') {
      var c = state.conclusion;
      return Boolean(c.restatedClaim.trim() || c.summaryOfBody.trim() || c.whyItMatters.trim());
    }
    if (page.type === 'final') {
      return Export.countEssayWords(state) > 0;
    }
    if (page.type === 'review') {
      return Export.buildSelfAssessmentSummary(state).isComplete;
    }
    return false;
  }

  function goToPage(index, focusSelector) {
    var pages = getPages();
    var clamped = Math.max(0, Math.min(index, pages.length - 1));
    state.currentPageIndex = clamped;
    saveState();
    render();

    if (focusSelector) {
      var target = elPageContent.querySelector(focusSelector);
      if (target) {
        target.focus({ preventScroll: true });
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function autoResizeTextarea(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight + 2, 92) + 'px';
  }

  function autoResizeAllTextareas() {
    var textareas = elPageContent.querySelectorAll('textarea');
    for (var i = 0; i < textareas.length; i++) {
      autoResizeTextarea(textareas[i]);
    }
  }

  /* ========================================================================
     Header Progress Bar & Step Pills Update
     ======================================================================== */
  function updateProgressAndMeta() {
    var pages = getPages();
    var total = pages.length;
    var currentIdx = Math.max(0, Math.min(state.currentPageIndex, total - 1));
    var currentPage = pages[currentIdx];

    var pct = Math.round(((currentIdx + 1) / total) * 100);
    elProgressFill.style.width = pct + '%';
    elProgressTrack.setAttribute('aria-valuenow', String(pct));
    elProgressStepLabel.textContent =
      'Page ' + (currentIdx + 1) + ' of ' + total + ' \u00B7 ' + currentPage.title;

    var wordCount = Export.countEssayWords(state);
    elWordCountBadge.textContent = wordCount + (wordCount === 1 ? ' word' : ' words');

    // Render clickable step pills
    elStepPills.innerHTML = '';
    for (var i = 0; i < pages.length; i++) {
      (function (idx, page) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'step-pill';
        var completed = isPageCompleted(page);
        if (idx === currentIdx) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-current', 'step');
        }
        if (completed) {
          btn.classList.add('is-completed');
        }

        var checkHtml = completed
          ? '<span class="step-check" aria-hidden="true">\u2713</span>'
          : '';
        btn.innerHTML =
          checkHtml +
          '<span>' + (idx + 1) + '. ' + Export.escapeHtml(page.shortLabel) + '</span>';

        btn.addEventListener('click', function () {
          goToPage(idx);
        });
        elStepPills.appendChild(btn);
      })(i, pages[i]);
    }
  }

  function updateLiveBadgesWithoutRerender() {
    var wordCount = Export.countEssayWords(state);
    elWordCountBadge.textContent = wordCount + (wordCount === 1 ? ' word' : ' words');

    var pages = getPages();
    var pills = elStepPills.querySelectorAll('.step-pill');
    for (var i = 0; i < pages.length; i++) {
      var pill = pills[i];
      if (!pill) continue;
      var completed = isPageCompleted(pages[i]);
      var hasCheck = pill.querySelector('.step-check');
      if (completed) {
        pill.classList.add('is-completed');
        if (!hasCheck) {
          var span = document.createElement('span');
          span.className = 'step-check';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = '\u2713';
          pill.insertBefore(span, pill.firstChild);
        }
      } else {
        pill.classList.remove('is-completed');
        if (hasCheck) {
          hasCheck.remove();
        }
      }
    }
  }

  /* ========================================================================
     Shared Footer Navigation Builder
     ======================================================================== */
  function buildFooterNavHtml(pages, currentIdx, extraCenterHtml) {
    var hasPrev = currentIdx > 0;
    var hasNext = currentIdx < pages.length - 1;
    var prevPage = hasPrev ? pages[currentIdx - 1] : null;
    var nextPage = hasNext ? pages[currentIdx + 1] : null;

    var leftBtn = hasPrev
      ? '<button type="button" class="btn btn-secondary" id="btn-nav-back">\u2190 Back: ' +
        Export.escapeHtml(prevPage.shortLabel) +
        '</button>'
      : '<div></div>';

    var centerBlock = extraCenterHtml
      ? '<div class="page-footer-center">' + extraCenterHtml + '</div>'
      : '';

    var rightBtn = hasNext
      ? '<button type="button" class="btn btn-primary" id="btn-nav-next">Next: ' +
        Export.escapeHtml(nextPage.shortLabel) +
        ' \u2192</button>'
      : '';

    return (
      '<div class="page-footer">' +
        leftBtn +
        centerBlock +
        rightBtn +
      '</div>'
    );
  }

  function wireFooterNav(currentIdx) {
    var backBtn = document.getElementById('btn-nav-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        goToPage(currentIdx - 1);
      });
    }
    var nextBtn = document.getElementById('btn-nav-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goToPage(currentIdx + 1);
      });
    }
  }

  /* ========================================================================
     Page 1: MLA Header & Setup
     ======================================================================== */
  function renderSetupPage(pages, currentIdx) {
    var s = state.setup;
    var todayMla = Export.formatTodayMla();
    var lastName = Export.extractLastName(s.studentName);
    var headerPreview = (lastName || 'LastName') + ' 1';

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Page 1 \u00B7 Setup</span>' +
          '<h2 class="page-title">MLA Header &amp; Setup</h2>' +
          '<p class="page-description">Fill out your essay heading details. These automatically build your MLA header, title, and top-right page number.</p>' +
        '</div>' +
      '</div>' +

      '<div class="form-stack">' +
        '<div class="form-grid-2">' +
          '<div class="field-group">' +
            '<label class="field-label" for="setup-student-name">Student Name</label>' +
            '<input type="text" id="setup-student-name" class="input-text" autocomplete="name" ' +
              'placeholder="e.g., Jordan Alvarez" value="' + Export.escapeHtml(s.studentName) + '">' +
          '</div>' +
          '<div class="field-group">' +
            '<label class="field-label" for="setup-teacher-name">Teacher Name</label>' +
            '<input type="text" id="setup-teacher-name" class="input-text" ' +
              'placeholder="e.g., Ms. Rivera" value="' + Export.escapeHtml(s.teacherName) + '">' +
          '</div>' +
        '</div>' +

        '<div class="form-grid-2">' +
          '<div class="field-group">' +
            '<label class="field-label" for="setup-class-period">Class / Period</label>' +
            '<input type="text" id="setup-class-period" class="input-text" ' +
              'placeholder="e.g., Language Arts, Period 3" value="' + Export.escapeHtml(s.classPeriod) + '">' +
          '</div>' +
          '<div class="field-group">' +
            '<label class="field-label" for="setup-date">Date <span class="field-sublabel">(MLA format: Day Month Year)</span></label>' +
            '<div class="date-input-row">' +
              '<input type="text" id="setup-date" class="input-text" ' +
                'placeholder="e.g., ' + Export.escapeHtml(todayMla) + '" value="' + Export.escapeHtml(s.date) + '">' +
              '<button type="button" class="btn btn-outline-teal btn-small" id="btn-fill-today" title="Insert today\'s date in MLA format">Today</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="setup-title">Essay Title</label>' +
          '<input type="text" id="setup-title" class="input-text" ' +
            'placeholder="Give your essay a clear, interesting title (you can always change it later)" value="' + Export.escapeHtml(s.title) + '">' +
        '</div>' +

        '<div class="info-callout">' +
          '<strong>MLA Top-Right Page Header Preview:</strong> ' +
          '<span id="mla-header-live-preview">' + Export.escapeHtml(headerPreview) + '</span> ' +
          '&mdash; Your last name is added automatically to the top-right corner of your final essay.' +
        '</div>' +
      '</div>' +

      buildFooterNavHtml(pages, currentIdx);

    var bindings = [
      { id: 'setup-student-name', key: 'studentName' },
      { id: 'setup-teacher-name', key: 'teacherName' },
      { id: 'setup-class-period', key: 'classPeriod' },
      { id: 'setup-date', key: 'date' },
      { id: 'setup-title', key: 'title' }
    ];

    bindings.forEach(function (item) {
      var input = document.getElementById(item.id);
      input.addEventListener('input', function () {
        state.setup[item.key] = input.value;
        saveState();
        updateLiveBadgesWithoutRerender();
        if (item.key === 'studentName') {
          var livePreview = document.getElementById('mla-header-live-preview');
          var ln = Export.extractLastName(input.value);
          livePreview.textContent = (ln || 'LastName') + ' 1';
        }
      });
    });

    document.getElementById('btn-fill-today').addEventListener('click', function () {
      var dateInput = document.getElementById('setup-date');
      dateInput.value = Export.formatTodayMla();
      state.setup.date = dateInput.value;
      saveState();
      updateLiveBadgesWithoutRerender();
      dateInput.focus();
    });

    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Page 2: Introduction Paragraph (3 Separate Input Boxes)
     ======================================================================== */
  function renderIntroPage(pages, currentIdx) {
    var intro = state.intro;

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Page 2 \u00B7 Introduction</span>' +
          '<h2 class="page-title">Introduction Paragraph</h2>' +
          '<p class="page-description">Build your opening paragraph in three clear parts. They will automatically combine into one smooth paragraph on the final page.</p>' +
        '</div>' +
      '</div>' +

      '<div class="form-stack">' +
        '<div class="field-group">' +
          '<label class="field-label" for="intro-hook">Hook <span class="field-sublabel">(Describe the topic without naming it directly)</span></label>' +
          '<textarea id="intro-hook" class="input-textarea" ' +
            'placeholder="For example, start with \'Imagine...\' and describe the situation or big idea without naming the book, article, or topic yet.">' +
            Export.escapeHtml(intro.hook) +
          '</textarea>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="intro-context">Context</label>' +
          '<textarea id="intro-context" class="input-textarea" ' +
            'placeholder="Introduce the topic, book, or article by explaining: \'This is what happens in...\' or \'This is what happens with...\'">' +
            Export.escapeHtml(intro.context) +
          '</textarea>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="intro-claim">Claim Statement</label>' +
          '<p class="field-hint">State your main thesis or claim clearly &mdash; this is the big idea your body paragraphs will prove.</p>' +
          '<textarea id="intro-claim" class="input-textarea" ' +
            'placeholder="Write one strong, clear sentence stating your main claim or argument...">' +
            Export.escapeHtml(intro.claim) +
          '</textarea>' +
        '</div>' +
      '</div>' +

      buildFooterNavHtml(pages, currentIdx);

    [
      { id: 'intro-hook', key: 'hook' },
      { id: 'intro-context', key: 'context' },
      { id: 'intro-claim', key: 'claim' }
    ].forEach(function (item) {
      var ta = document.getElementById(item.id);
      ta.addEventListener('input', function () {
        state.intro[item.key] = ta.value;
        autoResizeTextarea(ta);
        saveState();
        updateLiveBadgesWithoutRerender();
      });
    });

    autoResizeAllTextareas();
    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Pages 3..N: Body Paragraph Pages (Chunked Boxes + Repeatable Evidence)
     ======================================================================== */
  function renderBodyPage(pages, currentIdx, bodyIndex) {
    var bp = state.bodyParagraphs[bodyIndex];
    var bpNumber = bodyIndex + 1;
    var canDeleteBody = state.bodyParagraphs.length > 1;
    var canDeleteChunk = bp.evidenceChunks.length > 1;

    var chunksHtml = bp.evidenceChunks.map(function (chunk, chunkIdx) {
      var chunkNum = chunkIdx + 1;
      var removeChunkBtn = canDeleteChunk
        ? '<button type="button" class="btn btn-ghost-danger btn-remove-chunk" data-chunk-index="' + chunkIdx + '">Remove Chunk</button>'
        : '';

      return (
        '<div class="evidence-chunk-card" data-chunk-index="' + chunkIdx + '">' +
          '<div class="evidence-chunk-header">' +
            '<div class="evidence-chunk-badge">' +
              '<span class="evidence-chunk-num">' + chunkNum + '</span>' +
              '<span>Evidence Chunk ' + chunkNum + '</span>' +
            '</div>' +
            removeChunkBtn +
          '</div>' +

          '<div class="field-group">' +
            '<label class="field-label" for="bp-quote-' + chunkIdx + '">Evidence Chunk ' + chunkNum + ' <span class="field-sublabel">(Quote / Concrete Detail)</span></label>' +
            '<textarea id="bp-quote-' + chunkIdx + '" class="input-textarea is-compact" data-chunk-field="quote" data-chunk-index="' + chunkIdx + '" ' +
              'placeholder="Introduce and include your quote or specific evidence from the text (don\'t forget quotation marks and the citation, e.g., (Author 42)).">' +
              Export.escapeHtml(chunk.quote) +
            '</textarea>' +
          '</div>' +

          '<div class="field-group">' +
            '<label class="field-label" for="bp-summary-' + chunkIdx + '">Summary of the Quote <span class="field-sublabel">(What is happening in the quote?)</span></label>' +
            '<textarea id="bp-summary-' + chunkIdx + '" class="input-textarea is-compact" data-chunk-field="summary" data-chunk-index="' + chunkIdx + '" ' +
              'placeholder="In your own words, briefly explain what is happening in this quote or moment...">' +
              Export.escapeHtml(chunk.summary) +
            '</textarea>' +
          '</div>' +

          '<div class="field-group">' +
            '<label class="field-label" for="bp-explanation-' + chunkIdx + '">Explanation / Analysis <span class="field-sublabel">(How does this quote prove the topic sentence?)</span></label>' +
            '<textarea id="bp-explanation-' + chunkIdx + '" class="input-textarea" data-chunk-field="explanation" data-chunk-index="' + chunkIdx + '" ' +
              'placeholder="Explain why this evidence matters and how it clearly proves your topic sentence and claim...">' +
              Export.escapeHtml(chunk.explanation) +
            '</textarea>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var deleteBodyBtn = canDeleteBody
      ? '<button type="button" class="btn btn-ghost-danger" id="btn-delete-body">Delete Body Paragraph ' + bpNumber + '</button>'
      : '';

    var addBodyBtn =
      '<button type="button" class="btn btn-outline-teal" id="btn-add-body">+ Add Another Body Paragraph</button>';

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Page ' + (currentIdx + 1) + ' \u00B7 Body Paragraph</span>' +
          '<h2 class="page-title">Body Paragraph ' + bpNumber + '</h2>' +
          '<p class="page-description">Support your claim with a clear topic sentence, text evidence, analysis, and a strong wrap-up sentence.</p>' +
        '</div>' +
        deleteBodyBtn +
      '</div>' +

      '<div class="form-stack">' +
        '<div class="field-group">' +
          '<label class="field-label" for="bp-topic">Topic Sentence</label>' +
          '<textarea id="bp-topic" class="input-textarea is-compact" ' +
            'placeholder="State the main point of Body Paragraph ' + bpNumber + ' and connect it back to your claim...">' +
            Export.escapeHtml(bp.topicSentence) +
          '</textarea>' +
        '</div>' +

        '<div class="evidence-chunks-list" id="evidence-chunks-list">' +
          chunksHtml +
        '</div>' +

        '<div class="add-chunk-row">' +
          '<button type="button" class="btn btn-dashed" id="btn-add-evidence-chunk">+ Add Another Evidence Chunk</button>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="bp-concluding">Concluding Sentence</label>' +
          '<textarea id="bp-concluding" class="input-textarea is-compact" ' +
            'placeholder="Wrap up Body Paragraph ' + bpNumber + ' by tying your evidence back to your topic sentence and claim...">' +
            Export.escapeHtml(bp.concludingSentence) +
          '</textarea>' +
        '</div>' +
      '</div>' +

      buildFooterNavHtml(pages, currentIdx, addBodyBtn);

    // Wire Topic & Concluding Sentences
    var topicEl = document.getElementById('bp-topic');
    topicEl.addEventListener('input', function () {
      bp.topicSentence = topicEl.value;
      autoResizeTextarea(topicEl);
      saveState();
      updateLiveBadgesWithoutRerender();
    });

    var concludingEl = document.getElementById('bp-concluding');
    concludingEl.addEventListener('input', function () {
      bp.concludingSentence = concludingEl.value;
      autoResizeTextarea(concludingEl);
      saveState();
      updateLiveBadgesWithoutRerender();
    });

    // Wire Evidence Chunk textareas
    var chunkInputs = elPageContent.querySelectorAll('[data-chunk-field]');
    for (var i = 0; i < chunkInputs.length; i++) {
      (function (ta) {
        var idx = parseInt(ta.getAttribute('data-chunk-index'), 10);
        var field = ta.getAttribute('data-chunk-field');
        ta.addEventListener('input', function () {
          if (bp.evidenceChunks[idx]) {
            bp.evidenceChunks[idx][field] = ta.value;
            autoResizeTextarea(ta);
            saveState();
            updateLiveBadgesWithoutRerender();
          }
        });
      })(chunkInputs[i]);
    }

    // Wire "+ Add Another Evidence Chunk"
    document.getElementById('btn-add-evidence-chunk').addEventListener('click', function () {
      bp.evidenceChunks.push(createEmptyChunk());
      var newChunkIndex = bp.evidenceChunks.length - 1;
      saveState();
      render();
      var newQuoteBox = document.getElementById('bp-quote-' + newChunkIndex);
      if (newQuoteBox) {
        newQuoteBox.focus();
        newQuoteBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast('Added Evidence Chunk ' + (newChunkIndex + 1) + '.');
    });

    // Wire "Remove Chunk" buttons
    var removeChunkBtns = elPageContent.querySelectorAll('.btn-remove-chunk');
    for (var r = 0; r < removeChunkBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var chunkIdx = parseInt(btn.getAttribute('data-chunk-index'), 10);
          var targetChunk = bp.evidenceChunks[chunkIdx];
          if (!targetChunk || bp.evidenceChunks.length <= 1) return;

          var hasText = Boolean(
            targetChunk.quote.trim() ||
            targetChunk.summary.trim() ||
            targetChunk.explanation.trim()
          );

          var doRemove = function () {
            bp.evidenceChunks.splice(chunkIdx, 1);
            saveState();
            render();
            showToast('Evidence chunk removed.');
          };

          if (hasText) {
            openConfirmModal({
              title: 'Remove Evidence Chunk ' + (chunkIdx + 1) + '?',
              message:
                'This evidence chunk has writing in it. Removing it will permanently delete the quote, summary, and explanation inside this chunk.',
              confirmText: 'Remove Chunk',
              onConfirm: doRemove
            });
          } else {
            doRemove();
          }
        });
      })(removeChunkBtns[r]);
    }

    // Wire "+ Add Another Body Paragraph"
    document.getElementById('btn-add-body').addEventListener('click', function () {
      state.bodyParagraphs.push(createEmptyBodyParagraph());
      var newBodyNumber = state.bodyParagraphs.length;
      var newPageIndex = 2 + (state.bodyParagraphs.length - 1);
      goToPage(newPageIndex, '#bp-topic');
      showToast('Added Body Paragraph ' + newBodyNumber + '!');
    });

    // Wire "Delete Body Paragraph"
    var deleteBodyEl = document.getElementById('btn-delete-body');
    if (deleteBodyEl) {
      deleteBodyEl.addEventListener('click', function () {
        if (state.bodyParagraphs.length <= 1) return;

        var hasText = isPageCompleted({ type: 'body', bodyIndex: bodyIndex });
        var doDeleteBody = function () {
          state.bodyParagraphs.splice(bodyIndex, 1);
          var targetPage = bodyIndex > 0 ? 2 + (bodyIndex - 1) : 2;
          goToPage(targetPage);
          showToast('Body Paragraph ' + bpNumber + ' deleted.');
        };

        if (hasText) {
          openConfirmModal({
            title: 'Delete Body Paragraph ' + bpNumber + '?',
            message:
              'This body paragraph contains writing. Deleting it will permanently remove this page and all of its evidence chunks.',
            confirmText: 'Delete Paragraph',
            onConfirm: doDeleteBody
          });
        } else {
          doDeleteBody();
        }
      });
    }

    autoResizeAllTextareas();
    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Second-to-Last Page: Conclusion Paragraph (3 Separate Input Boxes)
     ======================================================================== */
  function renderConclusionPage(pages, currentIdx) {
    var c = state.conclusion;
    var originalClaim = Export.cleanChunk(state.intro.claim);

    var claimReferenceHtml = originalClaim
      ? '<div class="claim-reference-box">' +
          '<div class="claim-reference-label">Your Original Claim (from Page 2)</div>' +
          '<p class="claim-reference-text">\u201C' + Export.escapeHtml(originalClaim) + '\u201D</p>' +
        '</div>'
      : '<div class="claim-reference-box">' +
          '<div class="claim-reference-label">Your Original Claim (from Page 2)</div>' +
          '<p class="claim-reference-empty">' +
            '<span>You haven\u2019t written your Claim Statement on Page 2 yet.</span>' +
            '<button type="button" class="btn-link-inline" id="btn-jump-claim">Go to Page 2</button>' +
          '</p>' +
        '</div>';

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Page ' + (currentIdx + 1) + ' \u00B7 Conclusion</span>' +
          '<h2 class="page-title">Conclusion Paragraph</h2>' +
          '<p class="page-description">Bring your essay to a strong finish by restating your claim in fresh words, summarizing your main points, and leaving your reader with a lasting takeaway.</p>' +
        '</div>' +
      '</div>' +

      '<div class="form-stack">' +
        claimReferenceHtml +

        '<div class="field-group">' +
          '<label class="field-label" for="conc-restated-claim">Restated Claim</label>' +
          '<p class="field-hint">Rewrite your original claim statement above using fresh words and a new sentence structure.</p>' +
          '<textarea id="conc-restated-claim" class="input-textarea" ' +
            'placeholder="Say your main claim again in a fresh, confident way without copying Page 2 word-for-word...">' +
            Export.escapeHtml(c.restatedClaim) +
          '</textarea>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="conc-summary">Summary of Body Paragraphs</label>' +
          '<textarea id="conc-summary" class="input-textarea" ' +
            'placeholder="Write a short recap of the main points you proved in your body paragraphs...">' +
            Export.escapeHtml(c.summaryOfBody) +
          '</textarea>' +
        '</div>' +

        '<div class="field-group">' +
          '<label class="field-label" for="conc-mic-drop">Why It All Matters <span class="field-sublabel">(Mic Drop)</span></label>' +
          '<textarea id="conc-mic-drop" class="input-textarea" ' +
            'placeholder="Write 1\u20132 strong sentences explaining the bigger takeaway, lesson, or real-world significance...">' +
            Export.escapeHtml(c.whyItMatters) +
          '</textarea>' +
        '</div>' +
      '</div>' +

      buildFooterNavHtml(pages, currentIdx);

    var jumpBtn = document.getElementById('btn-jump-claim');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', function () {
        goToPage(1, '#intro-claim');
      });
    }

    [
      { id: 'conc-restated-claim', key: 'restatedClaim' },
      { id: 'conc-summary', key: 'summaryOfBody' },
      { id: 'conc-mic-drop', key: 'whyItMatters' }
    ].forEach(function (item) {
      var ta = document.getElementById(item.id);
      ta.addEventListener('input', function () {
        state.conclusion[item.key] = ta.value;
        autoResizeTextarea(ta);
        saveState();
        updateLiveBadgesWithoutRerender();
      });
    });

    autoResizeAllTextareas();
    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Final MLA Essay Page: Live MLA Formatted Essay
     ======================================================================== */
  function renderFinalEssayPage(pages, currentIdx) {
    var essay = Export.buildAssembledEssay(state);
    var summary = Export.buildSelfAssessmentSummary(state);
    var hasBodyText = essay.nonEmptyParagraphs.length > 0;

    function fieldOrPlaceholder(val, placeholder) {
      if (val) return Export.escapeHtml(val);
      return '<span class="mla-placeholder">' + Export.escapeHtml(placeholder) + '</span>';
    }

    var runningHeaderText = essay.lastName
      ? Export.escapeHtml(essay.lastName) + ' 1'
      : '<span class="mla-placeholder">LastName</span> 1';

    var paragraphsHtml = hasBodyText
      ? essay.nonEmptyParagraphs.map(function (p) {
          return '<p class="mla-paragraph">' + Export.escapeHtml(p.text) + '</p>';
        }).join('')
      : '<p class="mla-paragraph mla-placeholder">Your stitched essay paragraphs will appear here automatically as you fill in the Introduction, Body Paragraphs, and Conclusion pages.</p>';

    var emptyBannerHtml = hasBodyText
      ? ''
      : '<div class="empty-essay-banner">' +
          '<p>Your essay paragraphs are still empty! Use the steps above to write your Introduction, Body Paragraphs, and Conclusion.</p>' +
          '<button type="button" class="btn btn-primary btn-small" id="btn-jump-intro">Start Writing Introduction</button>' +
        '</div>';

    var assessmentCalloutText = summary.hasAnyActivity
      ? '<strong>Self-Assessment Included on Print/PDF:</strong> Checklist ' +
          summary.checklistChecked + '/' + summary.checklistTotal +
          ' \u00B7 Rubric ' + summary.ratedCount + '/' + summary.rubricTotal +
          (summary.overallLevel
            ? ' \u00B7 Overall: <strong>' + Export.escapeHtml(summary.overallLevel.code) + ' (' + Export.escapeHtml(summary.overallLevel.label) + ')</strong>'
            : '')
      : '<strong>Next Step &mdash; Review &amp; Rubric:</strong> Complete your Pre-Submission Checklist and 4-Level Proficiency Rubric on the next page to attach your self-evaluation summary when printing or saving as PDF.';

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Page ' + (currentIdx + 1) + ' \u00B7 MLA Preview &amp; Export</span>' +
          '<h2 class="page-title">Live MLA Formatted Essay</h2>' +
          '<p class="page-description">Every chunked box has been automatically stitched into complete, properly indented MLA paragraphs.</p>' +
        '</div>' +
      '</div>' +

      '<div class="mla-toolbar">' +
        '<div class="mla-toolbar-actions">' +
          '<button type="button" class="btn btn-primary" id="btn-copy-essay">Copy Essay to Clipboard</button>' +
          '<button type="button" class="btn btn-secondary" id="btn-print-essay">Print / Save as PDF</button>' +
          '<button type="button" class="btn btn-outline-teal" id="btn-jump-review">Review &amp; Rubric \u2192</button>' +
        '</div>' +
        '<span class="word-count-badge">' +
          essay.nonEmptyParagraphs.length + ' ' + (essay.nonEmptyParagraphs.length === 1 ? 'paragraph' : 'paragraphs') +
          ' \u00B7 ' + essay.wordCount + ' ' + (essay.wordCount === 1 ? 'word' : 'words') +
        '</span>' +
      '</div>' +

      '<div class="assessment-status-banner' + (summary.isComplete ? ' is-complete' : '') + '">' +
        '<span>' + assessmentCalloutText + '</span>' +
      '</div>' +

      '<p class="mla-tip">' +
        '<strong>Google Docs Tip:</strong> Click <em>Copy Essay to Clipboard</em> and press <strong>Ctrl+V</strong> (or <strong>Cmd+V</strong>) in Google Docs to keep paragraph breaks and MLA spacing. For PDF export, choose <em>Save as PDF</em> and uncheck browser <em>Headers and footers</em>.' +
      '</p>' +

      emptyBannerHtml +

      '<div class="mla-sheet-wrapper">' +
        '<article class="mla-paper" id="mla-paper" aria-label="MLA formatted essay preview">' +
          '<div class="mla-running-header">' + runningHeaderText + '</div>' +
          '<div class="mla-heading-block">' +
            '<p class="mla-heading-line">' + fieldOrPlaceholder(essay.header.studentName, 'Student Name') + '</p>' +
            '<p class="mla-heading-line">' + fieldOrPlaceholder(essay.header.teacherName, 'Teacher Name') + '</p>' +
            '<p class="mla-heading-line">' + fieldOrPlaceholder(essay.header.classPeriod, 'Class / Period') + '</p>' +
            '<p class="mla-heading-line">' + fieldOrPlaceholder(essay.header.date, 'Date') + '</p>' +
          '</div>' +
          '<h3 class="mla-title">' + fieldOrPlaceholder(essay.title, 'Essay Title') + '</h3>' +
          paragraphsHtml +
        '</article>' +
      '</div>' +

      buildFooterNavHtml(pages, currentIdx);

    var btnJumpIntro = document.getElementById('btn-jump-intro');
    if (btnJumpIntro) {
      btnJumpIntro.addEventListener('click', function () {
        goToPage(1, '#intro-hook');
      });
    }

    document.getElementById('btn-jump-review').addEventListener('click', function () {
      goToPage(currentIdx + 1);
    });

    var btnCopy = document.getElementById('btn-copy-essay');
    btnCopy.addEventListener('click', async function () {
      var result = await Export.copyEssayToClipboard(state);
      if (result.ok) {
        var originalLabel = btnCopy.textContent;
        btnCopy.textContent = '\u2713 Copied to Clipboard!';
        showToast('Essay copied! Paste into Google Docs with Ctrl+V or Cmd+V.');
        setTimeout(function () {
          btnCopy.textContent = originalLabel;
        }, 2200);
      } else if (result.reason === 'empty') {
        showToast('Write some text in your essay before copying.');
      } else {
        showToast('Could not access clipboard automatically. Try selecting the essay text manually.');
      }
    });

    var btnPrint = document.getElementById('btn-print-essay');
    btnPrint.addEventListener('click', function () {
      Export.printEssay(state);
    });

    Export.preparePrintBundle(state);
    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Review & Rubric Page: Interactive Checklist + 4-Level Proficiency Rubric
     ======================================================================== */
  function buildSelfEvalSummaryInnerHtml(summary) {
    var overallBadgeHtml = summary.overallLevel
      ? '<span class="level-badge level-badge--' + summary.overallLevel.code + '">' +
          Export.escapeHtml(summary.overallLevel.code) + ' \u2014 ' + Export.escapeHtml(summary.overallLevel.label) +
        '</span>'
      : '<span class="level-badge level-badge--none">Select scores above</span>';

    var breakdownChips = [];
    for (var i = Export.PROFICIENCY_LEVELS.length - 1; i >= 0; i--) {
      var lv = Export.PROFICIENCY_LEVELS[i];
      if (summary.levelCounts[lv.code] > 0) {
        breakdownChips.push(
          '<span class="level-chip level-badge--' + lv.code + '">' +
            summary.levelCounts[lv.code] + ' ' + lv.code +
          '</span>'
        );
      }
    }

    var traitRecapHtml = summary.traits
      .map(function (t) {
        var badgeCls = t.code ? 'level-badge level-badge--' + t.code : 'level-badge level-badge--none';
        var badgeText = t.code ? t.code + ' \u2014 ' + t.label : 'Not rated yet';
        return (
          '<div class="summary-trait-row">' +
            '<span class="summary-trait-name">' + Export.escapeHtml(t.name) + '</span>' +
            '<span class="' + badgeCls + '">' + Export.escapeHtml(badgeText) + '</span>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="summary-stats-grid">' +
        '<div class="summary-stat-card">' +
          '<span class="summary-stat-label">Pre-Submission Checklist</span>' +
          '<strong class="summary-stat-value">' + summary.checklistChecked + ' of ' + summary.checklistTotal + ' checked</strong>' +
        '</div>' +
        '<div class="summary-stat-card">' +
          '<span class="summary-stat-label">Rubric Traits Rated</span>' +
          '<strong class="summary-stat-value">' + summary.ratedCount + ' of ' + summary.rubricTotal + ' rated</strong>' +
        '</div>' +
        '<div class="summary-stat-card">' +
          '<span class="summary-stat-label">Overall Self-Assessment</span>' +
          '<div class="summary-stat-overall">' + overallBadgeHtml + '</div>' +
          (breakdownChips.length > 0
            ? '<div class="summary-breakdown-chips">' + breakdownChips.join('') + '</div>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="summary-trait-list">' + traitRecapHtml + '</div>'
    );
  }

  function renderReviewRubricPage(pages, currentIdx) {
    var summary = Export.buildSelfAssessmentSummary(state);

    var checklistHtml = summary.checklistItems
      .map(function (item) {
        return (
          '<label class="checklist-card' + (item.checked ? ' is-checked' : '') + '" data-checklist-card="' + item.id + '">' +
            '<input type="checkbox" class="checklist-checkbox" data-checklist-id="' + item.id + '"' +
              (item.checked ? ' checked' : '') + '>' +
            '<span class="checklist-custom-box" aria-hidden="true">' + (item.checked ? '\u2713' : '') + '</span>' +
            '<span class="checklist-text">' + Export.escapeHtml(item.text) + '</span>' +
          '</label>'
        );
      })
      .join('');

    var headerColsHtml = Export.PROFICIENCY_LEVELS.map(function (lv) {
      return (
        '<th scope="col" class="rubric-col-header rubric-col-' + lv.code + '">' +
          '<span class="rubric-code-pill level-badge--' + lv.code + '">' + lv.code + '</span>' +
          '<span class="rubric-col-title">' + Export.escapeHtml(lv.label) + '</span>' +
        '</th>'
      );
    }).join('');

    var rubricRowsHtml = Export.RUBRIC_TRAITS.map(function (trait) {
      var selectedCode = state.review.rubric[trait.id] || '';
      var cellsHtml = Export.PROFICIENCY_LEVELS.map(function (lv) {
        var isSelected = selectedCode === lv.code;
        return (
          '<td class="rubric-td">' +
            '<button type="button" class="rubric-cell-btn' + (isSelected ? ' is-selected is-selected-' + lv.code : '') + '" ' +
              'role="radio" aria-checked="' + (isSelected ? 'true' : 'false') + '" ' +
              'data-trait-id="' + trait.id + '" data-level-code="' + lv.code + '">' +
              '<span class="rubric-cell-top">' +
                '<span class="rubric-cell-code">' + lv.code + '</span>' +
                '<span class="rubric-cell-selected-tag">' + (isSelected ? '\u2713 Selected' : 'Select') + '</span>' +
              '</span>' +
              '<span class="rubric-cell-desc">' + Export.escapeHtml(trait.descriptors[lv.code]) + '</span>' +
            '</button>' +
          '</td>'
        );
      }).join('');

      return (
        '<tr class="rubric-row" role="radiogroup" aria-label="' + Export.escapeHtml(trait.name) + '">' +
          '<th scope="row" class="rubric-trait-cell">' +
            '<span class="rubric-trait-title">' + Export.escapeHtml(trait.name) + '</span>' +
            '<span class="rubric-trait-current" data-trait-status="' + trait.id + '">' +
              (selectedCode ? 'Selected: ' + selectedCode : 'Click a box to rate') +
            '</span>' +
          '</th>' +
          cellsHtml +
        '</tr>'
      );
    }).join('');

    elPageContent.innerHTML =
      '<div class="page-header-bar">' +
        '<div>' +
          '<span class="page-kicker">Final Step \u00B7 Student Self-Assessment</span>' +
          '<h2 class="page-title">Review &amp; Self-Assessment Rubric</h2>' +
          '<p class="page-description">Check your essay against the pre-submission checklist and click a proficiency level for each Trait of Writing. Your self-assessment summary is automatically included when you Print or Save as PDF.</p>' +
        '</div>' +
      '</div>' +

      /* Section 1: Pre-Submission Student Checklist */
      '<section class="review-section" aria-labelledby="checklist-heading">' +
        '<div class="review-section-header">' +
          '<div>' +
            '<h3 class="review-section-title" id="checklist-heading">1. Pre-Submission Student Checklist</h3>' +
            '<p class="review-section-sub">Check off each item once you have verified it in your MLA essay.</p>' +
          '</div>' +
          '<span class="word-count-badge' + (summary.checklistChecked === summary.checklistTotal ? ' is-complete' : '') + '" id="checklist-counter-badge">' +
            summary.checklistChecked + ' of ' + summary.checklistTotal + ' complete' +
          '</span>' +
        '</div>' +
        '<div class="checklist-stack">' + checklistHtml + '</div>' +
      '</section>' +

      /* Section 2: Interactive 4-Level Proficiency Rubric */
      '<section class="review-section" aria-labelledby="rubric-heading">' +
        '<div class="review-section-header">' +
          '<div>' +
            '<h3 class="review-section-title" id="rubric-heading">2. Traits of Writing Proficiency Rubric (DP, CP, PR, HP)</h3>' +
            '<p class="review-section-sub">Click one box in each row to highlight your self-assessed proficiency level.</p>' +
          '</div>' +
          '<span class="word-count-badge' + (summary.ratedCount === summary.rubricTotal ? ' is-complete' : '') + '" id="rubric-counter-badge">' +
            summary.ratedCount + ' of ' + summary.rubricTotal + ' traits rated' +
          '</span>' +
        '</div>' +
        '<div class="rubric-table-wrap">' +
          '<table class="rubric-table">' +
            '<thead>' +
              '<tr>' +
                '<th scope="col" class="rubric-corner-header">Traits of Writing</th>' +
                headerColsHtml +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rubricRowsHtml + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>' +

      /* Section 3: Self-Evaluation Summary & Export */
      '<section class="self-eval-summary" aria-labelledby="summary-heading">' +
        '<div class="self-eval-summary-header">' +
          '<div>' +
            '<h3 class="review-section-title" id="summary-heading">3. Your Self-Evaluation Summary</h3>' +
            '<p class="review-section-sub">This summary will print neatly on a separate page right after your MLA essay.</p>' +
          '</div>' +
          '<div class="mla-toolbar-actions">' +
            '<button type="button" class="btn btn-primary" id="btn-print-with-assessment">Print / Save Essay + Self-Assessment (PDF)</button>' +
            '<button type="button" class="btn btn-secondary" id="btn-copy-essay-review">Copy Essay to Clipboard</button>' +
          '</div>' +
        '</div>' +
        '<div id="self-eval-summary-body">' +
          buildSelfEvalSummaryInnerHtml(summary) +
        '</div>' +
      '</section>' +

      buildFooterNavHtml(pages, currentIdx);

    function refreshSummaryInPlace() {
      var updated = Export.buildSelfAssessmentSummary(state);
      var checklistBadge = document.getElementById('checklist-counter-badge');
      checklistBadge.textContent = updated.checklistChecked + ' of ' + updated.checklistTotal + ' complete';
      checklistBadge.classList.toggle('is-complete', updated.checklistChecked === updated.checklistTotal);

      var rubricBadge = document.getElementById('rubric-counter-badge');
      rubricBadge.textContent = updated.ratedCount + ' of ' + updated.rubricTotal + ' traits rated';
      rubricBadge.classList.toggle('is-complete', updated.ratedCount === updated.rubricTotal);

      document.getElementById('self-eval-summary-body').innerHTML = buildSelfEvalSummaryInnerHtml(updated);
      Export.preparePrintBundle(state, { includeAssessment: true });
      updateLiveBadgesWithoutRerender();
    }

    Export.preparePrintBundle(state, { includeAssessment: true });

    // Wire interactive checklist checkboxes
    var checkboxes = elPageContent.querySelectorAll('.checklist-checkbox');
    for (var c = 0; c < checkboxes.length; c++) {
      (function (cb) {
        cb.addEventListener('change', function () {
          var id = cb.getAttribute('data-checklist-id');
          state.review.checklist[id] = cb.checked;
          var card = cb.closest('.checklist-card');
          if (card) {
            card.classList.toggle('is-checked', cb.checked);
            var box = card.querySelector('.checklist-custom-box');
            if (box) box.textContent = cb.checked ? '\u2713' : '';
          }
          saveState();
          refreshSummaryInPlace();
        });
      })(checkboxes[c]);
    }

    // Wire interactive rubric grid buttons
    var rubricBtns = elPageContent.querySelectorAll('.rubric-cell-btn');
    for (var b = 0; b < rubricBtns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var traitId = btn.getAttribute('data-trait-id');
          var levelCode = btn.getAttribute('data-level-code');
          var current = state.review.rubric[traitId];
          var nextCode = current === levelCode ? '' : levelCode;
          state.review.rubric[traitId] = nextCode;

          // Update row button highlight states in-place
          var rowBtns = elPageContent.querySelectorAll('.rubric-cell-btn[data-trait-id="' + traitId + '"]');
          for (var k = 0; k < rowBtns.length; k++) {
            var rb = rowBtns[k];
            var rbCode = rb.getAttribute('data-level-code');
            var selected = rbCode === nextCode;
            rb.classList.remove('is-selected', 'is-selected-DP', 'is-selected-CP', 'is-selected-PR', 'is-selected-HP');
            if (selected) {
              rb.classList.add('is-selected', 'is-selected-' + rbCode);
            }
            rb.setAttribute('aria-checked', selected ? 'true' : 'false');
            var tag = rb.querySelector('.rubric-cell-selected-tag');
            if (tag) tag.textContent = selected ? '\u2713 Selected' : 'Select';
          }

          var traitStatus = elPageContent.querySelector('[data-trait-status="' + traitId + '"]');
          if (traitStatus) {
            traitStatus.textContent = nextCode ? 'Selected: ' + nextCode : 'Click a box to rate';
          }

          saveState();
          refreshSummaryInPlace();
        });
      })(rubricBtns[b]);
    }

    // Wire Print Essay + Self-Assessment button
    document.getElementById('btn-print-with-assessment').addEventListener('click', function () {
      Export.printEssay(state, { includeAssessment: true });
    });

    // Wire Copy Essay button
    var btnCopyReview = document.getElementById('btn-copy-essay-review');
    btnCopyReview.addEventListener('click', async function () {
      var result = await Export.copyEssayToClipboard(state);
      if (result.ok) {
        var orig = btnCopyReview.textContent;
        btnCopyReview.textContent = '\u2713 Copied to Clipboard!';
        showToast('Essay copied! Paste into Google Docs with Ctrl+V or Cmd+V.');
        setTimeout(function () {
          btnCopyReview.textContent = orig;
        }, 2200);
      } else if (result.reason === 'empty') {
        showToast('Write some text in your essay before copying.');
      } else {
        showToast('Could not access clipboard automatically. Try selecting the essay text manually.');
      }
    });

    wireFooterNav(currentIdx);
  }

  /* ========================================================================
     Master Render Loop & Browser Print Hook
     ======================================================================== */
  window.addEventListener('beforeprint', function () {
    var pages = getPages();
    var activePage = pages[state.currentPageIndex];
    var onReviewPage = activePage && activePage.type === 'review';
    Export.preparePrintBundle(state, {
      includeAssessment: onReviewPage || Export.buildSelfAssessmentSummary(state).hasAnyActivity
    });
  });

  function render() {
    var pages = getPages();
    if (state.currentPageIndex >= pages.length) {
      state.currentPageIndex = pages.length - 1;
    }
    if (state.currentPageIndex < 0) {
      state.currentPageIndex = 0;
    }

    var currentIdx = state.currentPageIndex;
    var page = pages[currentIdx];

    elMainContainer.classList.toggle('is-wide', page.type === 'final' || page.type === 'review');
    updateProgressAndMeta();

    if (page.type === 'setup') {
      renderSetupPage(pages, currentIdx);
    } else if (page.type === 'intro') {
      renderIntroPage(pages, currentIdx);
    } else if (page.type === 'body') {
      renderBodyPage(pages, currentIdx, page.bodyIndex);
    } else if (page.type === 'conclusion') {
      renderConclusionPage(pages, currentIdx);
    } else if (page.type === 'final') {
      renderFinalEssayPage(pages, currentIdx);
    } else if (page.type === 'review') {
      renderReviewRubricPage(pages, currentIdx);
    }
  }

  // Initial render
  render();
})();
