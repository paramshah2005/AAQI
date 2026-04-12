/**
 * Ordinary Least Squares (OLS) Linear Regression
 * Implemented from scratch — no external ML library needed.
 * 
 * Solves: β = (XᵀX)⁻¹ Xᵀy  (Normal Equation)
 * 
 * This finds the coefficients that minimize the sum of squared errors
 * between predicted and actual values.
 */

export interface TrainingRow {
  wind_speed: number;
  humidity: number;
  temperature: number;
  pressure: number;
  aqi_current: number;
  aqi_next: number; // label
}

export interface TrainedModel {
  // Learned coefficients
  intercept: number;
  coefficients: {
    wind_speed: number;
    humidity: number;
    temperature: number;
    pressure: number;
    aqi_current: number;
  };
  // Feature means from training data (for marginal effect calculation)
  feature_means: {
    wind_speed: number;
    humidity: number;
    temperature: number;
    pressure: number;
    aqi_current: number;
  };
  // Training metrics
  r_squared: number;
  mae: number;     // Mean Absolute Error
  rmse: number;    // Root Mean Squared Error
  training_rows: number;
  feature_names: string[];
}

// ═══════════════════════════════════════
// Matrix Operations (for Normal Equation)
// ═══════════════════════════════════════

type Matrix = number[][];
type Vector = number[];

/** Transpose a matrix */
function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

/** Multiply two matrices */
function multiply(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result: Matrix = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

/** Multiply matrix by vector */
function multiplyVec(A: Matrix, v: Vector): Vector {
  return A.map(row => row.reduce((sum, val, j) => sum + val * v[j], 0));
}

/** Invert a square matrix using Gauss-Jordan elimination */
function invert(A: Matrix): Matrix | null {
  const n = A.length;
  // Augmented matrix [A | I]
  const aug: Matrix = A.map((row, i) => {
    const newRow = [...row];
    for (let j = 0; j < n; j++) {
      newRow.push(i === j ? 1 : 0);
    }
    return newRow;
  });

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-10) return null; // Singular matrix

    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse from right half
  return aug.map(row => row.slice(n));
}

// ═══════════════════════════════════════
// Training Function
// ═══════════════════════════════════════

/**
 * Trains a linear regression model using OLS Normal Equation.
 * 
 * Features: [wind_speed, humidity, temperature, pressure, aqi_current]
 * Label: aqi_next (AQI measured 1 hour later)
 * 
 * The model learns: given current weather + current AQI,
 * what will the AQI be in the next hour?
 */
export function trainModel(data: TrainingRow[]): TrainedModel | null {
  if (data.length < 10) return null; // Need minimum data

  const n = data.length;
  const featureNames = ['wind_speed', 'humidity', 'temperature', 'pressure', 'aqi_current'];
  const p = featureNames.length; // 5 features

  // Compute feature means (needed for marginal effect display)
  const means = {
    wind_speed: data.reduce((s, r) => s + r.wind_speed, 0) / n,
    humidity: data.reduce((s, r) => s + r.humidity, 0) / n,
    temperature: data.reduce((s, r) => s + r.temperature, 0) / n,
    pressure: data.reduce((s, r) => s + r.pressure, 0) / n,
    aqi_current: data.reduce((s, r) => s + r.aqi_current, 0) / n,
  };

  // Build X matrix (n × p+1) with intercept column
  const X: Matrix = data.map(row => [
    1, // intercept
    row.wind_speed,
    row.humidity,
    row.temperature,
    row.pressure,
    row.aqi_current,
  ]);

  // Build y vector
  const y: Vector = data.map(row => row.aqi_next);

  // Normal Equation: β = (XᵀX)⁻¹ Xᵀy
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtX_inv = invert(XtX);

  if (!XtX_inv) {
    console.error('Matrix is singular, cannot train model');
    return null;
  }

  const Xty = multiplyVec(Xt, y);
  const beta = multiplyVec(XtX_inv, Xty);

  // ═══ Compute Metrics ═══

  // Predictions
  const predictions = X.map(row => row.reduce((sum, val, j) => sum + val * beta[j], 0));

  // Mean of y
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  // R² (coefficient of determination)
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares
  let absErrorSum = 0;

  for (let i = 0; i < n; i++) {
    const residual = y[i] - predictions[i];
    ssRes += residual * residual;
    ssTot += (y[i] - yMean) * (y[i] - yMean);
    absErrorSum += Math.abs(residual);
  }

  const r_squared = 1 - ssRes / ssTot;
  const mae = absErrorSum / n;
  const rmse = Math.sqrt(ssRes / n);

  return {
    intercept: Number(beta[0].toFixed(4)),
    coefficients: {
      wind_speed: Number(beta[1].toFixed(4)),
      humidity: Number(beta[2].toFixed(4)),
      temperature: Number(beta[3].toFixed(4)),
      pressure: Number(beta[4].toFixed(4)),
      aqi_current: Number(beta[5].toFixed(4)),
    },
    feature_means: {
      wind_speed: Number(means.wind_speed.toFixed(2)),
      humidity: Number(means.humidity.toFixed(2)),
      temperature: Number(means.temperature.toFixed(2)),
      pressure: Number(means.pressure.toFixed(2)),
      aqi_current: Number(means.aqi_current.toFixed(2)),
    },
    r_squared: Number(r_squared.toFixed(4)),
    mae: Number(mae.toFixed(2)),
    rmse: Number(rmse.toFixed(2)),
    training_rows: n,
    feature_names: featureNames,
  };
}

/**
 * Predict Feels Like AQI using the trained model.
 */
export function predict(model: TrainedModel, features: {
  wind_speed: number;
  humidity: number;
  temperature: number;
  pressure: number;
  aqi_current: number;
}): number {
  const raw =
    model.intercept +
    model.coefficients.wind_speed * features.wind_speed +
    model.coefficients.humidity * features.humidity +
    model.coefficients.temperature * features.temperature +
    model.coefficients.pressure * features.pressure +
    model.coefficients.aqi_current * features.aqi_current;

  return Math.max(0, Math.min(500, Math.round(raw)));
}
