// Lightweight logistic regression trainer.
//
// Plain L2-regularized batch gradient descent. No scientific
// dependencies. Designed to run inside a Netlify scheduled function
// in under 5 seconds on a few thousand feedback events.
//
// Why not iteratively reweighted least squares / Newton: convergence
// of GD is slow but stable, deterministic, and trivially debuggable.
// Our feature space is small (~12 dims) and our training set is
// small (hundreds → low thousands of labels), so wall time isn't
// the bottleneck — code clarity and replayability are.

export type FitConfig = {
  iterations?: number;
  learning_rate?: number;
  l2?: number;
  // When true, we keep an interim coefficient snapshot every
  // `snapshot_every` iterations for inspection during training.
  snapshot_every?: number;
};

export type FitInput = {
  feature_names: string[];
  // Row-major matrix of features. X[i] is feature vector for sample i.
  // First column should typically be 1 (intercept term).
  X: number[][];
  y: number[]; // binary 0/1 outcomes
};

export type FitResult = {
  feature_names: string[];
  coefficients: number[];
  intercept: number;
  iterations_run: number;
  final_loss: number;
  // Snapshots kept for the retrain audit trail.
  snapshots: { iter: number; coef: number[]; intercept: number; loss: number }[];
  // Calibration: Platt scaling parameters (slope a, bias b) so that
  // calibrated_p = sigmoid(a * raw_log_odds + b). Fit only when we
  // have at least 50 samples; smaller training sets keep a=1,b=0.
  calibration: { a: number; b: number };
  training_samples: number;
};

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function clip(p: number): number {
  // Avoid log(0).
  return Math.max(1e-9, Math.min(1 - 1e-9, p));
}

/**
 * Fit logistic regression to (X, y). Returns coefficients +
 * calibration parameters. The intercept is treated as coefficient[0]
 * paired with a constant 1 feature, then split out into the
 * result.intercept for readability.
 */
export function fitLogistic(
  input: FitInput,
  cfg: FitConfig = {}
): FitResult {
  const iterations = cfg.iterations ?? 400;
  const lr = cfg.learning_rate ?? 0.05;
  const l2 = cfg.l2 ?? 0.001;
  const snapshotEvery = cfg.snapshot_every ?? 100;

  const n = input.X.length;
  const d = input.X[0]?.length ?? 0;
  if (n === 0 || d === 0) {
    return {
      feature_names: input.feature_names,
      coefficients: new Array(d).fill(0),
      intercept: 0,
      iterations_run: 0,
      final_loss: 0,
      snapshots: [],
      calibration: { a: 1, b: 0 },
      training_samples: 0,
    };
  }

  // Initialise weights at zero — equivalent to a prior of "no signal".
  const w = new Array(d).fill(0);
  const snapshots: FitResult["snapshots"] = [];
  let loss = 0;

  for (let it = 0; it < iterations; it++) {
    // Forward: predictions and accumulated loss.
    const grad = new Array(d).fill(0);
    let l = 0;
    for (let i = 0; i < n; i++) {
      const z = dot(input.X[i], w);
      const p = sigmoid(z);
      const err = p - input.y[i];
      for (let k = 0; k < d; k++) {
        grad[k] += err * input.X[i][k];
      }
      const pc = clip(p);
      l += -(input.y[i] * Math.log(pc) + (1 - input.y[i]) * Math.log(1 - pc));
    }
    l /= n;
    // L2 regularisation (skip intercept at index 0 by convention).
    for (let k = 1; k < d; k++) {
      l += 0.5 * l2 * w[k] * w[k];
      grad[k] += l2 * w[k];
    }
    // SGD-batch step.
    for (let k = 0; k < d; k++) {
      w[k] -= (lr * grad[k]) / n;
    }
    loss = l;
    if (it % snapshotEvery === 0 || it === iterations - 1) {
      snapshots.push({
        iter: it,
        coef: w.slice(1),
        intercept: w[0],
        loss: l,
      });
    }
  }

  // Platt calibration. Only meaningful with enough samples.
  let a = 1;
  let b = 0;
  if (n >= 50) {
    // Build z = X·w then fit y ~ sigmoid(a*z + b) via 100 more GD
    // steps on (a, b) alone.
    const z = input.X.map((row) => dot(row, w));
    let aa = 1;
    let bb = 0;
    for (let it = 0; it < 100; it++) {
      let gradA = 0;
      let gradB = 0;
      for (let i = 0; i < n; i++) {
        const p = sigmoid(aa * z[i] + bb);
        const err = p - input.y[i];
        gradA += err * z[i];
        gradB += err;
      }
      aa -= (lr * gradA) / n;
      bb -= (lr * gradB) / n;
    }
    a = aa;
    b = bb;
  }

  return {
    feature_names: input.feature_names,
    coefficients: w.slice(1),
    intercept: w[0],
    iterations_run: iterations,
    final_loss: loss,
    snapshots,
    calibration: { a, b },
    training_samples: n,
  };
}
