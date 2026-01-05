/**
 * ITU E2E script: MapMaster + StepMaster + Introspect (variant B).
 *
 * This script is intended to be run via tsx from the
 * viewer/display-engine-pipeline package, for example:
 *
 *   cd D:\\07\\viewer\\display-engine-pipeline
 *   pnpm tsx ./src/e2e/itu-e2e-mapmaster-introspect.ts
 *
 * It builds a MapMasterRequest for 1/3 + 2/5 (sum of two fractions
 * with different denominators), runs BasicMapMaster (variant B),
 * and then builds a compact introspection summary that can be used
 * by Viewer dev/diagnostic tools.
 */

import { BasicMapMaster } from '../../../../mapmaster-bridge/src/mapmaster.basic';
import { buildMapMasterIntrospectSummary } from '../../../../mapmaster-bridge/src/mapmaster.introspect';
import type { MapMasterRequest } from '../../../../mapmaster-bridge/src/mapmaster.api';

async function main() {
  const mapMaster = new BasicMapMaster();

  const latex = '\\frac{1}{3} + \\frac{2}{5}';

  const req: MapMasterRequest = {
    mode: 'preview',
    expression: {
      id: 'ex-001',
      latex,
      displayVersion: 'itu-e2e-mapmaster-introspect',
      invariantSetId: 'fractions-basic.v1',
    },
    clientEvent: {
      type: 'click',
      timestamp: Date.now(),
      latex,
      surfaceNodeId: 'surf-whole-expression',
      selection: ['surf-frac-1', 'surf-plus', 'surf-frac-2'],
      click: {
        button: 'left',
        clickCount: 1,
        modifiers: {
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        },
      },
    },
    tsaSelection: {
      selectionMapVersion: 'sm-v1',
      primaryRegionId: 'tsa-sum-of-two-fractions',
      allRegionIds: ['tsa-frac-1', 'tsa-plus', 'tsa-frac-2'],
      flags: {
        isWholeFraction: false,
      },
    },
    policy: {
      stepLevel: 'student',
      allowMultipleSteps: false,
      maxCandidates: 3,
    },
    engineView: {
      stage1: '1/3 + 2/5',
      root: {
        kind: 'binaryOp',
        op: 'add',
        indexInStage1: 0,
        left: {
          kind: 'rational',
          numerator: '1',
          denominator: '3',
        },
        right: {
          kind: 'rational',
          numerator: '2',
          denominator: '5',
        },
      },
    },
  };

  const plan = mapMaster.planStep(req);
  const summary = buildMapMasterIntrospectSummary(req, plan);

  // Pretty-print everything for now; later Viewer can render the JSON in UI.
  console.log('[ITU-E2E-MAPMASTER-INTROSPECT] Request:');
  console.log(JSON.stringify(req, null, 2));

  console.log('[ITU-E2E-MAPMASTER-INTROSPECT] Plan:');
  console.log(JSON.stringify(plan, null, 2));

  console.log('[ITU-E2E-MAPMASTER-INTROSPECT] Summary:');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('[ITU-E2E-MAPMASTER-INTROSPECT] ERROR:', err);
  process.exitCode = 1;
});
