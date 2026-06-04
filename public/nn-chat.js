'use strict';
// 一番下を表示
window.addEventListener('load', () => {
  // URLにアンカーがある場合は、ブラウザ標準のアンカー移動を優先
  if (location.hash) {
    return;
  }
  window.scrollTo(0, document.body.scrollHeight);
});

// エンターキー と Ctrlキー(Macの場合はCommandキー)を押していたら送信
const formElement = document.forms['message-form'];
const textareaElement = formElement ? formElement.elements['content'] : null;
if (textareaElement) {
  textareaElement.addEventListener('keydown', (event) => {
    // 送信キーを押したら
    if (isPressedSubmitKey(event)) {
      // キーボード入力をキャンセルして送信
      event.preventDefault();
      formElement.submit();
    }
  });
}

// 投稿番号を押したら、その投稿へのアンカー文字列を入力欄に追加
document.querySelectorAll('.post-anchor').forEach((anchorElement) => {
  anchorElement.addEventListener('click', () => {
    const postId = anchorElement.dataset.postId;
    appendAnchorText(`>>${postId}`);
  });
});

// 本文中の「>>投稿番号」を、その投稿へ移動するリンクに変換
document.querySelectorAll('.post-content').forEach((contentElement) => {
  linkifyAnchorText(contentElement);
});

// data-confirm付きのボタンは、送信前に確認ダイアログを表示
document.querySelectorAll('[data-confirm]').forEach((confirmElement) => {
  confirmElement.addEventListener('click', (event) => {
    if (!confirm(confirmElement.dataset.confirm)) {
      event.preventDefault();
    }
  });
});

// textContentを部品に分けて作ることで、本文のHTMLエスケープを保ったままリンクだけ追加
function linkifyAnchorText(contentElement) {
  const anchorPattern = />>(\d+)/g;
  const contentText = contentElement.textContent;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = anchorPattern.exec(contentText)) !== null) {
    fragment.append(document.createTextNode(contentText.slice(lastIndex, match.index)));

    const postId = match[1];
    const linkElement = document.createElement('a');
    linkElement.href = `#post-${postId}`;
    linkElement.textContent = match[0];
    fragment.append(linkElement);

    lastIndex = anchorPattern.lastIndex;
  }

  fragment.append(document.createTextNode(contentText.slice(lastIndex)));
  contentElement.textContent = '';
  contentElement.append(fragment);
}

// 入力途中の文章を消さずに、必要なら改行してからアンカーを追加
function appendAnchorText(anchorText) {
  if (!textareaElement) {
    return;
  }
  const currentText = textareaElement.value;
  const separator = currentText && !currentText.endsWith('\n') ? '\n' : '';
  textareaElement.value = `${currentText}${separator}${anchorText}`;
  textareaElement.focus();
}

// 送信キーを押しているか判定
function isPressedSubmitKey(event) {
  if (event.key !== 'Enter') {
    return false;
  }
  if (event.ctrlKey) {
    return true;
  }
  // MacのCommandキーはmetaKeyという名前
  if (event.metaKey) {
    return true;
  }
}

// ツールチップの有効化
const tooltipTriggerElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
tooltipTriggerElements.forEach((tooltipTriggerElement) => {
  new bootstrap.Tooltip(tooltipTriggerElement);
});
