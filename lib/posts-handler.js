'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });
const util = require('./handler-util');
const boardsHandler = require('./boards-handler');
const { currentThemeKey } = require('../config');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/ja');
dayjs.locale('ja');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.tz.setDefault('Asia/Tokyo');
const crypto = require('node:crypto');

const oneTimeTokenMap = new Map(); // キーをユーザ名、値をトークンとする連想配列

async function handle(req, res, boardId) {
  const cookies = new Cookies(req, res);
  const currentTheme = cookies.get(currentThemeKey) || 'light';
  const options = { maxAge: 30 * 86400 * 1000 };
  cookies.set(currentThemeKey, currentTheme, options);
  const board = await boardsHandler.findActiveBoard(boardId);
  if (!board) {
    handleRedirect(res, '/boards');
    return;
  }
  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      const posts = await prisma.post.findMany({
        where: {
          boardId: board.id
        },
        orderBy: {
          id: 'asc'
        }
      });
      posts.forEach((post) => {
        post.relativeCreatedAt = dayjs(post.createdAt).tz().fromNow();
        post.absoluteCreatedAt = dayjs(post.createdAt).tz().format('YYYY年MM月DD日 HH時mm分ss秒');
      });
      const oneTimeToken = crypto.randomBytes(8).toString('hex');
      oneTimeTokenMap.set(req.user, oneTimeToken);
      res.end(pug.renderFile('./views/posts.pug', {
        currentTheme,
        board,
        posts,
        user: req.user,
        oneTimeToken
      }));
      console.info(
        `閲覧されました: user: ${req.user}, ` +
        `remoteAddress: ${req.socket.remoteAddress}, ` +
        `userAgent: ${req.headers['user-agent']} `
      );
      break;
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const content = params.get('content');
        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!content) {
          handleRedirectPosts(req, res, board.id);
          return;
        }
        if (!requestedOneTimeToken) {
          util.handleBadRequest(req, res);
          return;
        }
        if (oneTimeTokenMap.get(req.user) !== requestedOneTimeToken) {
          util.handleBadRequest(req, res);
          return;
        }
        console.info(`送信されました: ${content}`);
        await prisma.post.create({
          data: {
            content,
            postedBy: req.user,
            boardId: board.id
          }
        });
        oneTimeTokenMap.delete(req.user);
        handleRedirectPosts(req, res, board.id);
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

async function handleDefaultPosts(req, res) {
  if (req.method !== 'GET') {
    util.handleBadRequest(req, res);
    return;
  }
  const mainBoard = await boardsHandler.ensureMainBoard();
  handleRedirect(res, `/boards/${mainBoard.id}/posts`);
}

function handleRedirectPosts(req, res, boardId) {
  handleRedirect(res, `/boards/${boardId}/posts`);
}

function handleRedirect(res, location) {
  res.writeHead(303, {
    'Location': location
  });
  res.end();
}

async function handleDelete(req, res, boardId) {
  const board = await boardsHandler.findActiveBoard(boardId);
  if (!board) {
    handleRedirect(res, '/boards');
    return;
  }
  switch (req.method) {
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const id = parseInt(params.get('id'));
        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!id) {
          util.handleBadRequest(req, res);
          return;
        }
        if (!requestedOneTimeToken) {
          util.handleBadRequest(req, res);
          return;
        }
        if (oneTimeTokenMap.get(req.user) !== requestedOneTimeToken) {
          util.handleBadRequest(req, res);
          return;
        }
        const post = await prisma.post.findUnique({
          where: { id }
        });
        if (!post || post.boardId !== board.id) {
          util.handleBadRequest(req, res);
          return;
        }
        if (req.user === post.postedBy || req.user === 'admin') {
          await prisma.post.delete({
            where: { id }
          });
          console.info(
            `削除されました: user: ${req.user}, ` +
              `remoteAddress: ${req.socket.remoteAddress}, ` +
              `userAgent: ${req.headers['user-agent']} `
          );
          oneTimeTokenMap.delete(req.user);
          handleRedirectPosts(req, res, board.id);
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

module.exports = {
  handle,
  handleDefaultPosts,
  handleDelete,
};
