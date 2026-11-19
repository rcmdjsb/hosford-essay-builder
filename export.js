/* ==========================================================================
   Hosford Essay Builder — Export, Rubric & MLA Formatting Engine (export.js)
   Handles paragraph stitching, MLA preview data, self-assessment rubric data,
   rich/plain clipboard copy for Google Docs, and MLA + Self-Assessment PDF print.
   ========================================================================== */

(function (global) {
  'use strict';

  var MLA_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var CHECKLIST_ITEMS = [
    {
      id: 'hook',
      text: 'My hook describes the topic without naming it directly.'
    },
    {
      id: 'context',
      text: 'I introduced the title/topic in my context before stating my claim.'
    },
    {
      id: 'evidence',
      text: 'Every quote has both a summary and an explanation connecting back to the topic sentence.'
    },
    {
      id: 'conclusion',
      text: 'My conclusion restates my claim in new words and ends with why it matters.'
    },
    {
      id: 'mla',
      text: 'My MLA heading, title, and paragraph indents are complete.'
    }
  ];

  var PROFICIENCY_LEVELS = [
    { code: 'DP', label: 'Developing Proficiency', score: 1 },
    { code: 'CP', label: 'Close to Proficiency', score: 2 },
    { code: 'PR', label: 'Proficient', score: 3 },
    { code: 'HP', label: 'Highly Proficient', score: 4 }
  ];

  var LEVEL_BY_CODE = {};
  for (var l = 0; l < PROFICIENCY_LEVELS.length; l++) {
    LEVEL_BY_CODE[PROFICIENCY_LEVELS[l].code] = PROFICIENCY_LEVELS[l];
  }

  var RUBRIC_TRAITS = [
    {
      id: 'ideas',
      name: 'Ideas & Claim',
      descriptors: {
        DP: 'Claim is missing or unclear; ideas wander off-topic or need much more development.',
        CP: 'Claim is present, though broad or slightly unclear; most ideas connect to the topic.',
        PR: 'Clear, focused claim stated in the introduction and supported consistently across all paragraphs.',
        HP: 'Insightful, compelling claim sustained throughout with original ideas and a memorable "why it matters" takeaway.'
      }
    },
    {
      id: 'organization',
      name: 'Organization & Chunking',
      descriptors: {
        DP: 'Paragraphs are missing key parts (hook, topic sentences, or conclusion); ideas feel out of order.',
        CP: 'Most essay parts are present, though transitions or paragraph chunk order feel choppy in spots.',
        PR: 'Logical flow from hook, context, and claim through chunked body paragraphs to a clear restated conclusion.',
        HP: 'Seamless transitions and purposeful paragraph chunking guide the reader smoothly from an engaging hook to a strong ending.'
      }
    },
    {
      id: 'evidence',
      name: 'Evidence & Elaboration',
      descriptors: {
        DP: 'Little or no text evidence; quotes appear without summary or explanation.',
        CP: 'Includes quotes with brief summary, but explanations only partially prove the topic sentence.',
        PR: 'Relevant quotes are paired with clear summaries and solid explanations that prove each topic sentence.',
        HP: 'Well-chosen, smoothly integrated evidence paired with deep, persuasive analysis that convincingly proves the claim.'
      }
    },
    {
      id: 'voice',
      name: 'Voice & Word Choice',
      descriptors: {
        DP: 'Language is overly casual, repetitive, or unclear; academic voice feels inconsistent.',
        CP: 'Mostly appropriate academic tone with some strong words, though phrasing repeats at times.',
        PR: 'Clear, confident academic voice with precise vocabulary appropriate for a middle school essay.',
        HP: 'Engaging, authoritative voice with vivid, exact word choice and varied sentences that hold the reader\'s interest.'
      }
    },
    {
      id: 'conventions',
      name: 'Conventions & MLA Format',
      descriptors: {
        DP: 'Frequent grammar, spelling, or punctuation errors; MLA heading, title, or indents are missing.',
        CP: 'Some spelling, grammar, or punctuation errors or minor MLA formatting mistakes remain.',
        PR: 'Strong spelling, grammar, and punctuation; complete 4-line MLA heading, centered title, double-spacing, and 0.5" indents.',
        HP: 'Polished, virtually error-free conventions and spotless MLA formatting ready to publish.'
      }
    }
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeCssString(str) {
    return String(str || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, ' ');
  }

  function cleanChunk(text) {
    if (!text) return '';
    return String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function stitchParagraph(parts) {
    var cleaned = [];
    for (var i = 0; i < parts.length; i++) {
      var piece = cleanChunk(parts[i]);
      if (piece) {
        cleaned.push(piece);
      }
    }
    return cleaned.join(' ');
  }

  function extractLastName(studentName) {
    var trimmed = cleanChunk(studentName);
    if (!trimmed) return '';
    var tokens = trimmed.split(' ');
    return tokens[tokens.length - 1];
  }

  function formatTodayMla() {
    var now = new Date();
    return now.getDate() + ' ' + MLA_MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  }

  function countWordsInText(text) {
    var trimmed = cleanChunk(text);
    if (!trimmed) return 0;
    return trimmed.split(' ').filter(Boolean).length;
  }

  /**
   * Builds the complete stitched essay structure from application state.
   */
  function buildAssembledEssay(state) {
    var setup = state.setup || {};
    var intro = state.intro || {};
    var bodyParagraphs = Array.isArray(state.bodyParagraphs) ? state.bodyParagraphs : [];
    var conclusion = state.conclusion || {};

    var header = {
      studentName: cleanChunk(setup.studentName),
      teacherName: cleanChunk(setup.teacherName),
      classPeriod: cleanChunk(setup.classPeriod),
      date: cleanChunk(setup.date)
    };

    var title = cleanChunk(setup.title);
    var lastName = extractLastName(header.studentName);

    var paragraphs = [];

    // Introduction Paragraph
    var introText = stitchParagraph([intro.hook, intro.context, intro.claim]);
    paragraphs.push({
      key: 'intro',
      label: 'Introduction',
      text: introText
    });

    // Body Paragraphs 1..N
    for (var i = 0; i < bodyParagraphs.length; i++) {
      var bp = bodyParagraphs[i] || {};
      var pieces = [bp.topicSentence];
      var chunks = Array.isArray(bp.evidenceChunks) ? bp.evidenceChunks : [];
      for (var j = 0; j < chunks.length; j++) {
        var ch = chunks[j] || {};
        pieces.push(ch.quote, ch.summary, ch.explanation);
      }
      pieces.push(bp.concludingSentence);

      paragraphs.push({
        key: 'body-' + i,
        label: 'Body Paragraph ' + (i + 1),
        text: stitchParagraph(pieces)
      });
    }

    // Conclusion Paragraph
    var conclusionText = stitchParagraph([
      conclusion.restatedClaim,
      conclusion.summaryOfBody,
      conclusion.whyItMatters
    ]);
    paragraphs.push({
      key: 'conclusion',
      label: 'Conclusion',
      text: conclusionText
    });

    var nonEmptyParagraphs = paragraphs.filter(function (p) {
      return p.text.length > 0;
    });

    var wordCount = 0;
    for (var k = 0; k < nonEmptyParagraphs.length; k++) {
      wordCount += countWordsInText(nonEmptyParagraphs[k].text);
    }

    return {
      header: header,
      lastName: lastName,
      title: title,
      paragraphs: paragraphs,
      nonEmptyParagraphs: nonEmptyParagraphs,
      wordCount: wordCount
    };
  }

  function countEssayWords(state) {
    return buildAssembledEssay(state).wordCount;
  }

  /**
   * Computes checklist and 4-level proficiency rubric summary metrics.
   */
  function buildSelfAssessmentSummary(state) {
    var review = (state && state.review) || {};
    var checklistState = review.checklist || {};
    var rubricState = review.rubric || {};

    var checklistItems = [];
    var checklistChecked = 0;
    for (var i = 0; i < CHECKLIST_ITEMS.length; i++) {
      var item = CHECKLIST_ITEMS[i];
      var checked = Boolean(checklistState[item.id]);
      if (checked) checklistChecked += 1;
      checklistItems.push({
        id: item.id,
        text: item.text,
        checked: checked
      });
    }

    var traits = [];
    var levelCounts = { DP: 0, CP: 0, PR: 0, HP: 0 };
    var ratedCount = 0;
    var scoreSum = 0;

    for (var t = 0; t < RUBRIC_TRAITS.length; t++) {
      var trait = RUBRIC_TRAITS[t];
      var code = rubricState[trait.id] || '';
      var levelObj = LEVEL_BY_CODE[code] || null;
      if (levelObj) {
        ratedCount += 1;
        scoreSum += levelObj.score;
        levelCounts[levelObj.code] += 1;
      }
      traits.push({
        id: trait.id,
        name: trait.name,
        code: levelObj ? levelObj.code : '',
        label: levelObj ? levelObj.label : 'Not rated yet',
        descriptor: levelObj ? trait.descriptors[levelObj.code] : ''
      });
    }

    var overallLevel = null;
    var averageScore = 0;
    if (ratedCount > 0) {
      averageScore = scoreSum / ratedCount;
      var rounded = Math.max(1, Math.min(4, Math.round(averageScore)));
      overallLevel = PROFICIENCY_LEVELS[rounded - 1];
    }

    return {
      checklistItems: checklistItems,
      checklistChecked: checklistChecked,
      checklistTotal: CHECKLIST_ITEMS.length,
      traits: traits,
      ratedCount: ratedCount,
      rubricTotal: RUBRIC_TRAITS.length,
      levelCounts: levelCounts,
      averageScore: averageScore,
      overallLevel: overallLevel,
      hasAnyActivity: checklistChecked > 0 || ratedCount > 0,
      isComplete: checklistChecked === CHECKLIST_ITEMS.length && ratedCount === RUBRIC_TRAITS.length
    };
  }

  /**
   * Builds plain text with preserved paragraph breaks for universal pasting.
   */
  function buildPlainText(state) {
    var essay = buildAssembledEssay(state);
    var lines = [];

    var headerLines = [
      essay.header.studentName,
      essay.header.teacherName,
      essay.header.classPeriod,
      essay.header.date
    ].filter(Boolean);

    if (headerLines.length > 0) {
      lines.push(headerLines.join('\n'));
    }

    if (essay.title) {
      lines.push(essay.title);
    }

    for (var i = 0; i < essay.nonEmptyParagraphs.length; i++) {
      lines.push('\t' + essay.nonEmptyParagraphs[i].text);
    }

    return lines.join('\n\n');
  }

  /**
   * Builds rich MLA HTML so pasting into Google Docs preserves Times New Roman
   * 12pt, double-spacing, centered title, and 0.5-inch first-line indentation.
   */
  function buildMlaClipboardHtml(state) {
    var essay = buildAssembledEssay(state);
    var baseStyle =
      "font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; color: #000000; margin: 0; padding: 0;";

    var parts = [];
    parts.push('<div style="' + baseStyle + '">');

    var headerLines = [
      essay.header.studentName,
      essay.header.teacherName,
      essay.header.classPeriod,
      essay.header.date
    ].filter(Boolean);

    for (var h = 0; h < headerLines.length; h++) {
      parts.push(
        '<p style="' + baseStyle + ' text-align: left; text-indent: 0;">' +
          escapeHtml(headerLines[h]) +
          '</p>'
      );
    }

    if (essay.title) {
      parts.push(
        '<p style="' + baseStyle + ' text-align: center; text-indent: 0; font-weight: normal;">' +
          escapeHtml(essay.title) +
          '</p>'
      );
    }

    for (var i = 0; i < essay.nonEmptyParagraphs.length; i++) {
      parts.push(
        '<p style="' + baseStyle + ' text-align: left; text-indent: 0.5in;">' +
          escapeHtml(essay.nonEmptyParagraphs[i].text) +
          '</p>'
      );
    }

    parts.push('</div>');
    return parts.join('');
  }

  function legacyCopyPlainText(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    var success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      success = false;
    }

    document.body.removeChild(textarea);
    return success;
  }

  /**
   * Copies the formatted essay to the clipboard (rich MLA HTML + plain text).
   */
  async function copyEssayToClipboard(state) {
    var plainText = buildPlainText(state);
    var htmlText = buildMlaClipboardHtml(state);

    if (!plainText.trim()) {
      return { ok: false, reason: 'empty' };
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      try {
        var item = new ClipboardItem({
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
        return { ok: true, mode: 'rich' };
      } catch (err) {
        // Fall through to writeText
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(plainText);
        return { ok: true, mode: 'plain' };
      } catch (err) {
        // Fall through to legacy execCommand
      }
    }

    var fallbackOk = legacyCopyPlainText(plainText);
    return fallbackOk
      ? { ok: true, mode: 'plain' }
      : { ok: false, reason: 'blocked' };
  }

  /**
   * Builds the full printable HTML bundle: MLA essay pages + attached
   * Student Self-Assessment Summary sheet (on its own clean page).
   */
  function buildPrintBundleHtml(state, options) {
    var opts = options || {};
    var essay = buildAssembledEssay(state);
    var summary = buildSelfAssessmentSummary(state);
    var includeAssessment = opts.includeAssessment !== undefined
      ? Boolean(opts.includeAssessment)
      : summary.hasAnyActivity;

    var headerHtml = [
      essay.header.studentName,
      essay.header.teacherName,
      essay.header.classPeriod,
      essay.header.date
    ]
      .filter(Boolean)
      .map(function (line) {
        return '<p class="mla-heading-line">' + escapeHtml(line) + '</p>';
      })
      .join('');

    var titleHtml = essay.title
      ? '<h1 class="mla-title">' + escapeHtml(essay.title) + '</h1>'
      : '';

    var paragraphsHtml = essay.nonEmptyParagraphs
      .map(function (p) {
        return '<p class="mla-paragraph">' + escapeHtml(p.text) + '</p>';
      })
      .join('');

    var runningHeaderHtml = essay.lastName
      ? '<div class="mla-running-header">' + escapeHtml(essay.lastName) + ' 1</div>'
      : '<div class="mla-running-header">1</div>';

    var essaySection =
      '<article class="mla-paper print-mla-section">' +
        runningHeaderHtml +
        '<div class="mla-heading-block">' + headerHtml + '</div>' +
        titleHtml +
        paragraphsHtml +
      '</article>';

    if (!includeAssessment) {
      return essaySection;
    }

    var metaBits = [];
    if (essay.header.studentName) metaBits.push('<strong>Student:</strong> ' + escapeHtml(essay.header.studentName));
    if (essay.header.classPeriod) metaBits.push('<strong>Class/Period:</strong> ' + escapeHtml(essay.header.classPeriod));
    if (essay.header.date) metaBits.push('<strong>Date:</strong> ' + escapeHtml(essay.header.date));
    if (essay.title) metaBits.push('<strong>Essay Title:</strong> ' + escapeHtml(essay.title));

    var checklistRows = summary.checklistItems
      .map(function (item) {
        var mark = item.checked ? '\u2611' : '\u2610';
        var cls = item.checked ? 'print-check-item is-checked' : 'print-check-item';
        return (
          '<li class="' + cls + '">' +
            '<span class="print-check-box">' + mark + '</span>' +
            '<span>' + escapeHtml(item.text) + '</span>' +
          '</li>'
        );
      })
      .join('');

    var rubricRows = summary.traits
      .map(function (t) {
        var badgeCls = t.code ? 'print-level-badge level-' + t.code : 'print-level-badge level-none';
        var badgeText = t.code ? t.code + ' \u2014 ' + t.label : 'Not rated';
        var descText = t.descriptor || 'No level selected yet.';
        return (
          '<tr>' +
            '<td class="print-trait-name">' + escapeHtml(t.name) + '</td>' +
            '<td class="print-trait-score"><span class="' + badgeCls + '">' + escapeHtml(badgeText) + '</span></td>' +
            '<td class="print-trait-desc">' + escapeHtml(descText) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    var overallText = summary.overallLevel
      ? summary.overallLevel.code + ' \u2014 ' + summary.overallLevel.label
      : 'Not rated yet';

    var breakdownParts = [];
    for (var p = PROFICIENCY_LEVELS.length - 1; p >= 0; p--) {
      var lv = PROFICIENCY_LEVELS[p];
      if (summary.levelCounts[lv.code] > 0) {
        breakdownParts.push(summary.levelCounts[lv.code] + ' ' + lv.code);
      }
    }
    var breakdownText = breakdownParts.length > 0 ? breakdownParts.join(' \u00B7 ') : 'No traits rated yet';

    var assessmentSection =
      '<section class="print-self-assessment">' +
        '<header class="print-sa-header">' +
          '<div class="print-sa-kicker">Hosford Essay Builder \u00B7 Hosford Middle School</div>' +
          '<h2 class="print-sa-title">Student Self-Assessment Summary</h2>' +
          (metaBits.length > 0
            ? '<div class="print-sa-meta">' + metaBits.join(' &nbsp;|&nbsp; ') + '</div>'
            : '') +
        '</header>' +

        '<div class="print-sa-overview">' +
          '<div class="print-sa-stat">' +
            '<div class="print-sa-stat-label">Pre-Submission Checklist</div>' +
            '<div class="print-sa-stat-value">' + summary.checklistChecked + ' of ' + summary.checklistTotal + ' Checked</div>' +
          '</div>' +
          '<div class="print-sa-stat">' +
            '<div class="print-sa-stat-label">Rubric Traits Rated</div>' +
            '<div class="print-sa-stat-value">' + summary.ratedCount + ' of ' + summary.rubricTotal + ' Traits</div>' +
          '</div>' +
          '<div class="print-sa-stat">' +
            '<div class="print-sa-stat-label">Overall Self-Evaluation</div>' +
            '<div class="print-sa-stat-value">' + escapeHtml(overallText) + '</div>' +
            '<div class="print-sa-stat-sub">' + escapeHtml(breakdownText) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="print-sa-block">' +
          '<h3 class="print-sa-heading">Pre-Submission Student Checklist</h3>' +
          '<ul class="print-checklist">' + checklistRows + '</ul>' +
        '</div>' +

        '<div class="print-sa-block">' +
          '<h3 class="print-sa-heading">Traits of Writing Rubric Self-Evaluation (DP / CP / PR / HP)</h3>' +
          '<table class="print-rubric-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Trait of Writing</th>' +
                '<th>Self-Assessed Level</th>' +
                '<th>Descriptor</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rubricRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>';

    return essaySection + assessmentSection;
  }

  /**
   * Populates the hidden print bundle and injects dynamic @page MLA header rules.
   */
  function preparePrintBundle(state, options) {
    var essay = buildAssembledEssay(state);
    var bundleEl = document.getElementById('print-bundle');
    if (bundleEl) {
      bundleEl.innerHTML = buildPrintBundleHtml(state, options);
    }

    var styleId = 'mla-dynamic-print-style';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    var headerPrefix = essay.lastName ? escapeCssString(essay.lastName) + ' ' : '';
    styleEl.textContent =
      '@media print {\n' +
      '  @page {\n' +
      '    size: letter;\n' +
      '    margin: 1in;\n' +
      '    @top-right {\n' +
      '      content: "' + headerPrefix + '" counter(page);\n' +
      '      font-family: "Times New Roman", Times, serif;\n' +
      '      font-size: 12pt;\n' +
      '      color: #000000;\n' +
      '      vertical-align: bottom;\n' +
      '      padding-bottom: 0.25in;\n' +
      '    }\n' +
      '  }\n' +
      '  @page :first {\n' +
      '    @top-right {\n' +
      '      content: none;\n' +
      '    }\n' +
      '  }\n' +
      '  @page assessment {\n' +
      '    size: letter;\n' +
      '    margin: 0.7in;\n' +
      '    @top-right {\n' +
      '      content: none;\n' +
      '    }\n' +
      '  }\n' +
      '}\n';
  }

  /**
   * Prepares the printable MLA essay (+ self-assessment summary) and opens Print/PDF.
   */
  function printEssay(state, options) {
    var essay = buildAssembledEssay(state);
    preparePrintBundle(state, options);

    var originalTitle = document.title;
    var suggestedFilename = essay.title
      ? essay.title
      : (essay.lastName ? essay.lastName + ' - MLA Essay' : 'Hosford MLA Essay');
    document.title = suggestedFilename;

    var restoreTitle = function () {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    window.print();
    setTimeout(restoreTitle, 1500);
  }

  global.HosfordExport = {
    CHECKLIST_ITEMS: CHECKLIST_ITEMS,
    PROFICIENCY_LEVELS: PROFICIENCY_LEVELS,
    RUBRIC_TRAITS: RUBRIC_TRAITS,
    escapeHtml: escapeHtml,
    cleanChunk: cleanChunk,
    stitchParagraph: stitchParagraph,
    extractLastName: extractLastName,
    formatTodayMla: formatTodayMla,
    buildAssembledEssay: buildAssembledEssay,
    countEssayWords: countEssayWords,
    buildSelfAssessmentSummary: buildSelfAssessmentSummary,
    buildPlainText: buildPlainText,
    buildMlaClipboardHtml: buildMlaClipboardHtml,
    copyEssayToClipboard: copyEssayToClipboard,
    buildPrintBundleHtml: buildPrintBundleHtml,
    preparePrintBundle: preparePrintBundle,
    printEssay: printEssay
  };
})(window);
