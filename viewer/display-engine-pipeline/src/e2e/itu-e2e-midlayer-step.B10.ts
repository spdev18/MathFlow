/**
 * ITU E2E script: MidlayerStepEngine + MapMaster + StepMaster + Engine (B10).
 *
 * Цель:
 *   - построить честный MapMasterRequest для 1/3 + 2/5
 *   - прогнать его через MidlayerStepEngine (BasicMapMaster + StepMaster + EngineClient)
 *   - увидеть план кандидатов шага и ответ от Engine (engineResult.summary)
 *
 * Запуск:
 *
 *   cd D:\08
 *   cd viewer\display-engine-pipeline
 *   pnpm tsx .\src\e2e\itu-e2e-midlayer-step.B10.ts
 */

import { MidlayerStepEngine } from '../../../../mapmaster-bridge/src/midlayer.actions.core';
import type { StudentActionCore } from '../../../../mapmaster-bridge/src/midlayer.actions.types';

async function main() {
  const latex = '\\frac{1}{3} + \\frac{2}{5}';

  // MidlayerStepEngine: внутри BasicMapMaster + MapMasterEngineOrchestrator + NginHttpEngineClient.
  const engine = new MidlayerStepEngine({
    baseUrl: 'http://localhost:4201',
    path: '/api/entry-step',
  });

  // Честный MapMasterRequest по образцу itu-e2e-mapmaster-introspect.ts.
  const req: StudentActionCore = {
    mode: 'preview',
    expression: {
      id: 'ex-midlayer-001',
      latex,
      displayVersion: 'itu-e2e-midlayer-step-B10',
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

  console.log('[ITU-E2E-MIDLAYER-STEP] Request:');
  console.log(JSON.stringify(req, null, 2));

  try {
    const result = await engine.runSingleStep(req);

    console.log('[ITU-E2E-MIDLAYER-STEP] Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('[ITU-E2E-MIDLAYER-STEP] ERROR WHILE RUNNING:', err);
  }
}

main().catch((err) => {
  console.error('[ITU-E2E-MIDLAYER-STEP] FATAL ERROR:', err);
  process.exitCode = 1;
});
