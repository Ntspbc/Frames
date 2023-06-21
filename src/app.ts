import express, { Express } from "express";
import bodyParser from "body-parser";
import { getDbClient, migrateToLatest } from './db.js';
import './env.js';
import { log } from './log.js';
import {signerAddress} from "./signature.js";
import {createTransfer, getTransferById, getTransferHistory, ValidationError} from "./transfers.js";

const db = await getDbClient();
migrateToLatest(db, log);

export const app: Express = express();
app.use(bodyParser.json());

app.get('/transfers', async (req, res) => {
  const since = Number(req.query.since ?? 0);
  const transfers = await getTransferHistory(since, db);
  res.send({ transfers });
});

app.post('/transfers', async (req, res) => {
  let tr;
  try {
    tr = req.body;
    const result = await createTransfer({
      username: tr.name,
      from: tr.from,
      to: tr.to,
      timestamp: tr.timestamp,
      owner: tr.owner,
      userSignature: tr.signature,
      userFid: tr.fid,
    }, db);
    if (!result) {
      log.warn({name: tr.username}, `Unable to create transfer`);
      res.status(500).send({ error: 'Unable to create transfer' }).end();
      return
    }
    const transfer = await getTransferById(result.id, db);
    res.send({ transfer });
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      res.status(400).send({ error: 'Validation failure', code: e.code }).end();
    } else {
      log.error(e, "Unable to create transfer", tr)
      res.status(500).send({ error: `Unable to validate : ${e}` }).end();
    }
  }
});

app.get('/signer', async (_req, res) => {
  res.send({ signer: signerAddress });
});

app.get('/_health', async (_req, res) => {
  res.send({ status: 'ok' });
});