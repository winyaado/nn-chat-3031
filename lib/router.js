'use strict';
const postsHandler = require('./posts-handler');
const boardsHandler = require('./boards-handler');
const searchHandler = require('./search-handler');
const util = require('./handler-util');

function route(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const boardPostsMatch = pathname.match(/^\/boards\/(\d+)\/posts$/);
  const boardPostDeleteMatch = pathname.match(/^\/boards\/(\d+)\/posts\/delete$/);
  const boardDeleteMatch = pathname.match(/^\/boards\/(\d+)\/delete$/);
  const boardSearchMatch = pathname.match(/^\/boards\/(\d+)\/search$/);

  if (boardPostsMatch) {
    postsHandler.handle(req, res, parseInt(boardPostsMatch[1]));
    return;
  }
  if (boardPostDeleteMatch) {
    postsHandler.handleDelete(req, res, parseInt(boardPostDeleteMatch[1]));
    return;
  }
  if (boardDeleteMatch) {
    boardsHandler.handleDelete(req, res, parseInt(boardDeleteMatch[1]));
    return;
  }
  if (boardSearchMatch) {
    searchHandler.handleBoard(req, res, parseInt(boardSearchMatch[1]));
    return;
  }

  switch (pathname) {
    case '/boards':
      boardsHandler.handleList(req, res);
      break;
    case '/boards/create':
      boardsHandler.handleCreate(req, res);
      break;
    case '/search':
      searchHandler.handleAll(req, res);
      break;
    case '/posts':
      postsHandler.handleDefaultPosts(req, res);
      break;
    case '/posts/delete':
      util.handleBadRequest(req, res);
      break;
    case '/logout':
      util.handleLogout(req, res);
      break;
    case '/changeTheme':
      util.handleChangeTheme(req, res);
      break;
    case '/favicon.ico':
      util.handleFavicon(req, res);
      break;
    case '/style.css':
      util.handleStyleCssFile(req, res);
      break;
    case '/nn-chat.js':
      util.handleNnChatJsFile(req, res);
      break;
    case '/':
      util.handleTopPage(req, res);
      break;
    default:
      util.handleNotFound(req, res);
      break;
  }
}

module.exports = {
  route
};
