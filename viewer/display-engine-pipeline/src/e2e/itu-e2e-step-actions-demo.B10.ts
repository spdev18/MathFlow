/**
 * ITU E2E script: MidlayerStepEngine + MapMaster + StepMaster + Engine (B10).
 *
 * Идея:
 *   - Берём тот же пример, что и в itu-e2e-mapmaster-introspect.ts:
 *       1/3 + 2/5 (сумма двух дробей с разными знаменателями)
 *   - Собираем MapMasterRequest "вручную"
 *   - Прогоняем через MidlayerStepEngine (который внутри использует
 *     BasicMapMaster + MapMasterEngineOrchestrator + NginHttpEngineClient)
 *   - Печатаем JSON-результат.
 *
 * Запуск (из пакета viewer/display-engine-pipeline):
 *
 *   cd D:\08
 *   cd viewer\display-engine-pipeline
 *   pnpm tsx .\src\e2e\itu-e2e-midlayer-step.B10.ts
 */

import { MidlayerStepEngine } from '../../../../mapmaster-bridge/src/midlayer.actions.core';
import type { StudentActionCore } from '../../../../mapmaster-bridge/src/midlayer.actions.types';
import type { MapMasterRequest } from '../../../../mapmaster-bridge/src/mapmaster.api';

async function main() {
  // Создаём midlayer с HTTP-клиентом к engine-server.mjs.
  // Порт и путь должны совпадать с твоим engine-adapter-lite.
  const engine = new MidlayerStepEngine({
    baseUrl: 'http://localhost:4201',
    path: '/api/entry-step',
  });

  const latex = '\\frac{1}{3} + \\frac{2}{5}';

  // ВАЖНО: это практически тот же запрос, что в
  // viewer/display-engine-pipeline/src/e2e/itu-e2e-mapmaster-introspect.ts
  const req: MapMasterRequest = {
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

  const action: StudentActionCore = req;

  console.log('[ITU-E2E-MIDLAYER-STEP] Request:');
  console.log(JSON.stringify(action, null, 2));

  const result = await engine.runSingleStep(action);

  console.log('[ITU-E2E-MIDLAYER-STEP] Result:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[ITU-E2E-MIDLAYER-STEP] ERROR:', err);
  process.exitCode = 1;
});
