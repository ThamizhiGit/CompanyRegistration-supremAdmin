import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { Kind, type DocumentNode } from 'graphql';
import * as documents from '../../src/lib/graphql';
import { createSchemaValidator } from '../fixtures/schema-validation';

// Every gql document the app sends, checked against the backend schema dump
// (tests/fixtures/superadmin-schema.graphql). The mocks used to accept
// documents the server refuses (a String! argument sent as String, a String
// user id for an Int argument), so a broken refund / promo deactivation / user
// edit passed every test.
const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../src');
const graphqlModule = path.join(srcDir, 'lib', 'graphql.ts');
const { document: checkDocument, request: check } = createSchemaValidator(
  fs.readFileSync(path.join(here, '../fixtures/superadmin-schema.graphql'), 'utf8'),
);

const isDocument = (value: unknown): value is DocumentNode =>
  !!value && typeof value === 'object' && (value as DocumentNode).kind === Kind.DOCUMENT;

const exportedDocuments = Object.entries(documents).filter((entry): entry is [string, DocumentNode] => isDocument(entry[1]));

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

test.describe('GraphQL documents match the backend schema', () => {
  for (const [name, document] of exportedDocuments) {
    test(name, () => {
      // The document only (each request's variables are checked by the mocks).
      expect(checkDocument(document)).toEqual([]);
    });
  }

  test('every gql document in src is an export of src/lib/graphql.ts (so it is checked above)', () => {
    const counts = sourceFiles(srcDir)
      .map((file) => ({ file: path.relative(srcDir, file), count: (fs.readFileSync(file, 'utf8').match(/\bgql`/g) || []).length }))
      .filter((entry) => entry.count > 0);
    expect(counts).toEqual([{ file: path.relative(srcDir, graphqlModule), count: exportedDocuments.length }]);
  });

  test('the checker refuses what the server refuses', () => {
    const refund = documents.ADMIN_REQUEST_REFUND_MUTATION;
    expect(check(refund, { paymentIntentId: 'pi_1', amount: 500, reason: 'Duplicate' })).toEqual([]);
    expect(check(refund, { paymentIntentId: 'pi_1', amount: 500 })).not.toEqual([]);
    expect(check('mutation { adminRequestRefund(paymentIntentId: "pi_1") { success } }')).not.toEqual([]);
    // A decimal percentage for an Int field is a GraphQL error on the server.
    const promo = documents.ADMIN_SAVE_PROMO_CODE_MUTATION;
    const input = { code: 'SAVE', discountType: 'percent', discountValue: 12, appliesToPlanIds: ['premium'] };
    expect(check(promo, { input })).toEqual([]);
    expect(check(promo, { input: { ...input, discountValue: 12.5 } }).join(' ')).toContain('non-integer');
    // User ids are Int on the server.
    expect(check(documents.ADMIN_UPDATE_USER_MUTATION, { userId: 'user-1' })).not.toEqual([]);
    expect(check(documents.ADMIN_UPDATE_USER_MUTATION, { userId: 11 })).toEqual([]);
  });
});
