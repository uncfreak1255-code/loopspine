export function calculateDogfoodMetrics(register) {
  if (register.target_tasks !== 10 || !Array.isArray(register.tasks) || register.tasks.length !== 10) {
    throw new Error("dogfood register must contain exactly ten target tasks");
  }
  const ids = new Set(register.tasks.map((task) => task.id));
  if (ids.size !== register.tasks.length) throw new Error("dogfood task ids must be unique");
  const completed = register.tasks.filter((task) => task.status === "completed");
  for (const task of completed) {
    if (task.loopspine_invoked !== true) throw new Error(`${task.id}: completed tasks must explicitly invoke LoopSpine`);
    if (typeof task.verified !== "boolean" || typeof task.incorrect_stop !== "boolean") {
      throw new Error(`${task.id}: completed tasks require verified and incorrect_stop booleans`);
    }
    if (!Number.isInteger(task.sawyer_interventions) || task.sawyer_interventions < 0) {
      throw new Error(`${task.id}: sawyer_interventions must be a non-negative integer`);
    }
    if (!Number.isFinite(task.time_to_proof_seconds) || task.time_to_proof_seconds <= 0 || !task.proof) {
      throw new Error(`${task.id}: completed tasks require positive time_to_proof_seconds and proof`);
    }
  }
  if (!completed.length) {
    return {
      completed_tasks: 0,
      target_tasks: 10,
      verified_completion_rate: null,
      sawyer_intervention_rate: null,
      median_time_to_proof_minutes: null,
      incorrect_stop_rate: null
    };
  }
  const durations = completed.map((task) => task.time_to_proof_seconds).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianSeconds = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
  const ratio = (count) => Number((count / completed.length).toFixed(4));
  return {
    completed_tasks: completed.length,
    target_tasks: 10,
    verified_completion_rate: ratio(completed.filter((task) => task.verified).length),
    sawyer_intervention_rate: ratio(completed.filter((task) => task.sawyer_interventions > 0).length),
    median_time_to_proof_minutes: Number((medianSeconds / 60).toFixed(2)),
    incorrect_stop_rate: ratio(completed.filter((task) => task.incorrect_stop).length)
  };
}

export function renderDogfoodMarkdown(metrics) {
  const percent = (value) => value == null ? "Pending" : `${(value * 100).toFixed(1)}%`;
  const time = metrics.median_time_to_proof_minutes == null ? "Pending" : `${metrics.median_time_to_proof_minutes} min`;
  return `# Dogfood Report\n\n` +
    `Progress: **${metrics.completed_tasks}/${metrics.target_tasks} real tasks**\n\n` +
    `| Metric | Result |\n|---|---:|\n` +
    `| Verified completion rate | ${percent(metrics.verified_completion_rate)} |\n` +
    `| Sawyer intervention rate | ${percent(metrics.sawyer_intervention_rate)} |\n` +
    `| Median time to proof | ${time} |\n` +
    `| Incorrect-stop rate | ${percent(metrics.incorrect_stop_rate)} |\n`;
}
