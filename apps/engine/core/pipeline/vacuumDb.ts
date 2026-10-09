import { vacuumDatabase } from '@neus/db';
import { logPipelineStep, PipelineStep } from '../../lib/pipelineLogger';

export async function vacuumDb() {
  logPipelineStep(PipelineStep.Vacuum, 'Reclaiming database storage with VACUUM ANALYZE...');
  await vacuumDatabase();
}
