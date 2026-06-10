import { getEvalSuiteFromEnv, loadEvalDataset } from "./loadDataset";

const dataset = loadEvalDataset({ suite: getEvalSuiteFromEnv() });

console.log(`Eval suite: ${dataset.suite}`);
console.log(`Cases: ${dataset.testCases.length}`);

for (const [index, testCase] of dataset.testCases.entries()) {
  const rationale = testCase.rationale ? `\n   rationale: ${testCase.rationale}` : "";
  console.log(`${index + 1}. ${testCase.id} [${testCase.difficulty}/${testCase.category}]`);
  console.log(`   prompt: ${testCase.input}${rationale}`);
}
