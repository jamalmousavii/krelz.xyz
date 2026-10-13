const pool = require('../database/pool');
const { chargeFreeTokens } = require('./freeAllowance');
const { chargeMinerCredit } = require('./minerCredit');
const { chargeTokenPot } = require('./tokenBundles');
const { getActivePlan } = require('./plans');
const { invalidateCache } = require('../cache');

const MINER_REVENUE_SHARE = 0.9;

// Single money mutation point (extracted verbatim from routes/chat.js).
// Chain, in order, inside ONE row-locked transaction:
//   1. daily free allowance (platform-funded, no miner share);
//   2. miner $1/day credit (platform-funded, no miner share);
//   3. prepaid token pot (miner earns 90% of catalog value from revenue);
//   4. USD wallet (miner earns 90% of the debit; dust drained in full);
//   5. race with nothing left → served as 'free' (generation never wasted).
// Guests (no userId) only ever reach legs 1 and 5.
// Returns the settlement snapshot; throws on DB errors (caller 500s).
async function settleMessage({ userId, guestKey, tokensUsed, cost, minerId, servedByMiner, freeCap, freeRemainingInit = null, bucketUserId = null, paymentCoin = 'USD', taskId = null }) {
  // v3.44.0 org shared bucket: the free leg drains the bucket owner's row
  // (the org leader when the org plan wins); every other leg stays per-user.
  const bucket = bucketUserId || userId;
  let paymentStatus = 'free';
  let minerCreditRemaining = null;
  let freeRemaining = freeRemainingInit;
  let tokenBalanceRemaining = null;
  let upgradeNotice = false;
  // Quota UX flags (read-only: billing untouched).
  let freeLow = false;
  let freeExhausted = false;

  const creditMinerEarning = async (client, earning, source) => {
    const payerPlan = await getActivePlan(userId, client);
    await client.query(
      'UPDATE miners SET earnings = earnings + $1 WHERE id = $2',
      [earning, minerId]
    );
    await client.query(
      `INSERT INTO miner_coin_earnings (miner_id, coin, amount, task_id, source, plan_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [minerId, paymentCoin, earning, taskId, source, payerPlan ? payerPlan.plan_type : 'free']
    );
  };

  if (cost > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

        const freeCharge = await chargeFreeTokens({
          userId: bucket, guestKey, tokens: tokensUsed, cap: freeCap, client,
        });
      freeRemaining = freeCharge.remaining;

        if (freeCharge.charged) {
          paymentStatus = 'free';
          if (freeRemaining <= 0) {
            freeExhausted = true;
          } else if (freeCap > 0 && freeRemaining <= freeCap * 0.1) {
            freeLow = true;
          }
        } else if (userId) {
        const creditCharge = await chargeMinerCredit(userId, cost, client);
        minerCreditRemaining = creditCharge.remaining;

        if (creditCharge.charged) {
          paymentStatus = 'free_miner';
        } else {
          const potCharge = await chargeTokenPot({ userId, tokens: tokensUsed, client });

          if (potCharge.charged) {
            tokenBalanceRemaining = potCharge.remaining;
            paymentStatus = 'tokens';
            // Flat 90% of the message's catalog value — same rate as the
            // wallet leg, paid from the platform's bundle revenue.
            if (minerId && servedByMiner) {
              await creditMinerEarning(client, cost * MINER_REVENUE_SHARE, 'tokens');
            }
          } else {
            const balanceResult = await client.query(
              'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2 FOR UPDATE',
              [userId, paymentCoin]
            );
            const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

            if (userBalance > 0) {
              // Drain dust: a sub-cost balance is taken in full, so the wallet
              // reaches exactly 0 instead of parking at $0.0000x forever.
              const debit = Math.min(cost, userBalance);
              await client.query(
                `UPDATE user_coin_balances
                    SET available = available - $1, total_spent = total_spent + $1
                  WHERE user_id = $2 AND coin = $3`,
                [debit, userId, paymentCoin]
              );

              // Only a miner that actually served the task earns.
              // Flat 90% for every payer (Free/Plus/Pro/Max alike).
              if (minerId && servedByMiner) {
                await creditMinerEarning(client, debit * MINER_REVENUE_SHARE, 'wallet');
              }
              paymentStatus = 'paid';
              upgradeNotice = true;
            }
            // else: race after pre-flight — serve free (step 5).
          }
        }
      }
      // Guests out of allowance mid-race: step 5 (status stays 'free').

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // The balance payload now carries free_tokens/pot too — any charge changes it.
    invalidateCache('/api/payments/balance');
  }

  return {
    paymentStatus,
    minerCreditRemaining,
    freeRemaining,
    tokenBalanceRemaining,
    upgradeNotice,
    freeLow,
    freeExhausted,
  };
}

module.exports = { settleMessage, MINER_REVENUE_SHARE };
