import { test } from "node:test";
import assert from "node:assert/strict";
import { isPushServiceUrl } from "../push-hosts";
import { pushSubscriptionSchema } from "../../ordering/admin-schemas";
import { databaseHost, isLocalHost } from "../../../../prisma/local-db-guard";

test("push endpoints: real browser push services are accepted", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAAA",
    "https://web.push.apple.com/QGuQyavX",
    "https://wns2-db5p.notify.windows.com/w/?token=BQYAAA",
  ]) {
    assert.equal(isPushServiceUrl(url), true, url);
  }
});

test("push endpoints: anything else is rejected", () => {
  for (const url of [
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user@fcm.googleapis.com/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilpush.apple.com/x",
    "https://internal-host.example/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "not a url",
  ]) {
    assert.equal(isPushServiceUrl(url), false, url);
  }
  const keys = { p256dh: "k", auth: "a" };
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint: "https://internal-host.example/x", keys }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys }).success, true);
});

test("seed guard: only local databases count as local", () => {
  const host = (url: string) => databaseHost(url);
  assert.equal(isLocalHost(host("postgresql://u:p@localhost:5432/shazdeh")), true);
  assert.equal(isLocalHost(host("postgresql://u:p@127.0.0.1/shazdeh")), true);
  assert.equal(isLocalHost(host("postgresql://u:p@db:5432/shazdeh")), true);
  assert.equal(isLocalHost(host("postgresql://u:p@ep-x-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require")), false);
  assert.equal(isLocalHost(host("not a url")), false);
});
