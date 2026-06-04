'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });
const util = require('./handler-util');
const { currentThemeKey } = require('../config');
const crypto = require('node:crypto');

const mainBoardName = 'メイン';
const oneTimeTokenMap = new Map(); // キーをユーザ名、値をトークンとする連想配列

async function handleList(req, res) {
  if (req.method !== 'GET') {
    util.handleBadRequest(req, res);
    return;
  }

  const currentTheme = getCurrentTheme(req, res);
  await ensureMainBoard();
  const boards = await prisma.board.findMany({
    where: {
      deletedAt: null
    },
    orderBy: {
      id: 'asc'
    }
  });
  const oneTimeToken = crypto.randomBytes(8).toString('hex');
  oneTimeTokenMap.set(req.user, oneTimeToken);

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(pug.renderFile('./views/boards.pug', {
    currentTheme,
    boards,
    user: req.user,
    oneTimeToken
  }));
}

function handleCreate(req, res) {
  if (req.method !== 'POST') {
    util.handleBadRequest(req, res);
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  }).on('end', async () => {
    const params = new URLSearchParams(body);
    const name = params.get('name') ? params.get('name').trim() : '';
    const requestedOneTimeToken = params.get('oneTimeToken');

    // 板名は空文字を禁止し、DBの上限に合わせて50文字までにする
    if (!name || name.length > 50) {
      util.handleBadRequest(req, res);
      return;
    }
    if (!isValidOneTimeToken(req.user, requestedOneTimeToken)) {
      util.handleBadRequest(req, res);
      return;
    }

    const existingBoard = await prisma.board.findUnique({
      where: { name }
    });
    if (existingBoard) {
      util.handleBadRequest(req, res);
      return;
    }

    const board = await prisma.board.create({
      data: {
        name,
        createdBy: req.user
      }
    });
    oneTimeTokenMap.delete(req.user);
    handleRedirect(res, `/boards/${board.id}/posts`);
  });
}

function handleDelete(req, res, boardId) {
  if (req.method !== 'POST') {
    util.handleBadRequest(req, res);
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  }).on('end', async () => {
    const params = new URLSearchParams(body);
    const requestedOneTimeToken = params.get('oneTimeToken');
    if (!isValidOneTimeToken(req.user, requestedOneTimeToken)) {
      util.handleBadRequest(req, res);
      return;
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId }
    });
    if (!board || board.deletedAt) {
      handleRedirect(res, '/boards');
      return;
    }

    // 板削除は管理者、または板を作った本人だけに許可する
    if (req.user !== 'admin' && req.user !== board.createdBy) {
      util.handleBadRequest(req, res);
      return;
    }

    await prisma.board.update({
      where: { id: board.id },
      data: {
        deletedAt: new Date()
      }
    });
    oneTimeTokenMap.delete(req.user);
    handleRedirect(res, '/boards');
  });
}

async function ensureMainBoard() {
  const mainBoard = await prisma.board.upsert({
    where: {
      name: mainBoardName
    },
    update: {},
    create: {
      name: mainBoardName,
      createdBy: 'admin'
    }
  });

  // 既存投稿は初期板に紐づけて、古いデータも板機能で表示できるようにする
  await prisma.post.updateMany({
    where: {
      boardId: null
    },
    data: {
      boardId: mainBoard.id
    }
  });

  return mainBoard;
}

async function findActiveBoard(boardId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId }
  });
  return board && !board.deletedAt ? board : null;
}

function getCurrentTheme(req, res) {
  const cookies = new Cookies(req, res);
  const currentTheme = cookies.get(currentThemeKey) || 'light';
  const options = { maxAge: 30 * 86400 * 1000 };
  cookies.set(currentThemeKey, currentTheme, options);
  return currentTheme;
}

function isValidOneTimeToken(user, requestedOneTimeToken) {
  return requestedOneTimeToken && oneTimeTokenMap.get(user) === requestedOneTimeToken;
}

function handleRedirect(res, location) {
  res.writeHead(303, {
    'Location': location
  });
  res.end();
}

module.exports = {
  handleList,
  handleCreate,
  handleDelete,
  ensureMainBoard,
  findActiveBoard,
  mainBoardName,
};
