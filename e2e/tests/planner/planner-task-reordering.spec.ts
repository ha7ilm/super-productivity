import { test, expect } from '../../fixtures/test.fixture';
import { cssSelectors } from '../../constants/selectors';

test('should drop an untimed task at the end of the planner Today list', async ({
  page,
  workViewPage,
  plannerPage,
}) => {
  await workViewPage.waitForTaskList();
  for (const title of ['First task', 'Second task', 'Third task']) {
    await workViewPage.addTask(title);
  }

  await plannerPage.navigateToPlanner();
  const tasks = page
    .locator(cssSelectors.PLANNER_VIEW)
    .locator('planner-day .normal-tasks-items planner-task');
  await expect(tasks).toHaveCount(3);
  const titles = tasks.locator('.title');
  const originalOrder = await titles.allTextContents();
  // Wait for the planner's route animation before measuring drag coordinates.
  await tasks.first().hover();
  const firstTask = await tasks.first().boundingBox();
  const lastTask = await tasks.last().boundingBox();
  if (!firstTask || !lastTask) {
    throw new Error('Planner task rows are not visible');
  }

  const halfWidth = firstTask.width / 2;
  const halfHeight = firstTask.height / 2;
  const x = firstTask.x + halfWidth;
  const startY = firstTask.y + halfHeight;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, startY + 10, { steps: 5 });
  await expect(page.locator('planner-task.cdk-drag-preview')).toBeVisible();
  await page.mouse.move(x, lastTask.y + lastTask.height - 2, { steps: 20 });
  await page.mouse.up();

  const expectedOrder = [...originalOrder.slice(1), originalOrder[0]];
  await expect(titles).toHaveText(expectedOrder);

  // The planner Today column shares its saved order with the Today work view.
  await page.goto('/#/tag/TODAY/tasks');
  await workViewPage.waitForTaskList();
  await expect(page.locator(cssSelectors.TASK_TITLE)).toHaveText(expectedOrder);
});
