import { test, expect } from '../../fixtures/test.fixture';
import { cssSelectors } from '../../constants/selectors';

for (const dayIndex of [0, 1]) {
  test(`should append untimed tasks added with + Add to ${dayIndex === 0 ? 'Today' : 'a future day'}`, async ({
    page,
    workViewPage,
    plannerPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    // Planner additions should append even when the global bar adds to the top.
    await page.evaluate(() => localStorage.setItem('SUP_IS_ADD_TO_BOTTOM', 'false'));
    await plannerPage.navigateToPlanner();

    const day = page
      .locator(cssSelectors.PLANNER_VIEW)
      .locator('planner-day')
      .nth(dayIndex);
    const titles = day.locator('.normal-tasks-items planner-task .title');
    const expectedOrder: string[] = [];
    await day.locator('add-task-inline [data-add-task-btn]').click();
    const addBar = day.locator('add-task-inline add-task-bar');

    for (const name of ['First task', 'Second task', 'Third task']) {
      const title = `${testPrefix}-${name}`;
      await addBar.locator('.main-input').fill(title);
      await addBar.locator('.e2e-add-task-submit').click();
      expectedOrder.push(title);
      await expect(titles).toHaveText(expectedOrder);
    }

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('SUP_IS_ADD_TO_BOTTOM')))
      .toBe('false');
  });
}
