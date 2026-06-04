'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });
const util = require('./handler-util');
const boardsHandler = require('./boards-handler');
const { currentThemeKey } = require('../config');

async function handleAll(req, res) {
  if (req.method !== 'GET') {
    util.handleBadRequest(req, res);
    return;
  }

  const keyword = getKeyword(req);
  if (!keyword) {
    handleRedirect(res, '/boards');
    return;
  }

  await boardsHandler.ensureMainBoard();
  const results = await searchPosts(keyword);
  renderSearch(req, res, {
    keyword,
    board: null,
    results,
    backUrl: '/boards'
  });
}

async function handleBoard(req, res, boardId) {
  if (req.method !== 'GET') {
    util.handleBadRequest(req, res);
    return;
  }

  const board = await boardsHandler.findActiveBoard(boardId);
  if (!board) {
    handleRedirect(res, '/boards');
    return;
  }

  const keyword = getKeyword(req);
  if (!keyword) {
    handleRedirect(res, `/boards/${board.id}/posts`);
    return;
  }

  const results = await searchPosts(keyword, board.id);
  renderSearch(req, res, {
    keyword,
    board,
    results,
    backUrl: `/boards/${board.id}/posts`
  });
}

async function searchPosts(keyword, boardId) {
  const where = {
    content: {
      contains: keyword
    },
    board: {
      deletedAt: null
    }
  };
  if (boardId) {
    where.boardId = boardId;
  }

  return prisma.post.findMany({
    where,
    include: {
      board: true
    },
    orderBy: {
      id: 'desc'
    }
  });
}

function renderSearch(req, res, values) {
  const currentTheme = getCurrentTheme(req, res);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(pug.renderFile('./views/search.pug', {
    currentTheme,
    user: req.user,
    ...values
  }));
}

function getKeyword(req) {
  const url = new URL(req.url, 'http://localhost');
  const keyword = url.searchParams.get('q');
  return keyword ? keyword.trim() : '';
}

function getCurrentTheme(req, res) {
  const cookies = new Cookies(req, res);
  const currentTheme = cookies.get(currentThemeKey) || 'light';
  const options = { maxAge: 30 * 86400 * 1000 };
  cookies.set(currentThemeKey, currentTheme, options);
  return currentTheme;
}

function handleRedirect(res, location) {
  res.writeHead(303, {
    'Location': location
  });
  res.end();
}

module.exports = {
  handleAll,
  handleBoard,
};
