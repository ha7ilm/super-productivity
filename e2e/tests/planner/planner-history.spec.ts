import { expect, test } from '../../fixtures/test.fixture';
import { waitForStatePersistence } from '../../utils/waits';

const touchTest = test.extend({
  contextOptions: {
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  },
});

test.describe('Planner History', () => {
  test('reviews current-week main tasks and opens read-only details with subtasks', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await page.clock.setSystemTime(new Date('2026-06-17T12:00:00'));
    await page.reload();
    await workViewPage.waitForTaskList();
    const title = `${testPrefix}-Completed parent`;
    const childTitle = `${testPrefix}-Completed child`;
    await workViewPage.addTask(title);
    const parent = taskPage.getTaskByText(title);
    await workViewPage.addSubTask(parent, childTitle);
    // The parent owns the first toggle; the general task helper also sees its
    // nested subtask toggles, so it cannot address this row unambiguously.
    await parent.locator('done-toggle').first().click();
    await expect(parent.first()).toHaveClass(/isDone/);
    await workViewPage.addTask(`${testPrefix}-Unfinished`);

    await page.goto('/#/planner');
    await expect(page.locator('page-title .page-title-actions')).toHaveCount(0);
    const plannerNavItem = page
      .locator('magic-side-nav nav-item')
      .filter({ has: page.locator('a[href="#/planner"]') });
    await plannerNavItem.hover();
    await plannerNavItem
      .getByRole('button', { name: 'More actions', exact: true })
      .click();
    await expect(
      page.getByRole('menuitem', { name: 'Disable feature', exact: true }),
    ).toBeVisible();
    const historyMenuItem = page.getByRole('menuitem', { name: 'History', exact: true });
    await expect(historyMenuItem).toBeFocused();
    await page.keyboard.press('Escape');
    await plannerNavItem.locator('a.nav-link').click({ button: 'right' });
    await historyMenuItem.press('Enter');
    await expect(page).toHaveURL(/\/planner\/history$/);
    const history = page.locator('planner-history');
    await expect(history.locator('planner-history-day')).toHaveCount(7);
    const row = history
      .locator('[data-day="2026-06-17"] .history-task')
      .filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(history.locator('.history-task')).toHaveCount(1);
    await expect(
      history.getByRole('button', { name: 'Next week', exact: true }),
    ).toBeDisabled();
    await expect(history.locator('done-toggle, inline-input, .cdk-drag')).toHaveCount(0);

    await row.focus();
    await page.keyboard.press('Enter');
    const details = page.locator('dialog-view-archived-task');
    await expect(details).toBeVisible();
    await expect(details.locator('.subtask-list')).toContainText(childTitle);
    await expect(details.locator('input, done-toggle, .repeat-value')).toHaveCount(0);
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(row).toBeFocused();
  });

  test('selects weeks well in the past, includes archived zero-time tasks and preserves navigation', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await page.clock.setSystemTime(new Date('2026-05-06T12:00:00'));
    await page.reload();
    await workViewPage.waitForTaskList();
    const title = `${testPrefix}-Archived May task`;
    await workViewPage.addTask(title);
    await taskPage.markTaskAsDone(taskPage.getTaskByText(title));
    await page.locator('.e2e-finish-day').click();
    await page.waitForURL(/daily-summary/);
    await Promise.all([
      page.waitForURL(/tag\/TODAY\/tasks/),
      page
        .locator('daily-summary button[mat-flat-button][color="primary"]:last-of-type')
        .click(),
    ]);
    await workViewPage.waitForTaskList();
    await expect(taskPage.getTaskByText(title)).toHaveCount(0);
    await waitForStatePersistence(page);

    await page.clock.setSystemTime(new Date('2026-06-17T12:00:00'));
    await page.goto('/#/planner/history');
    const history = page.locator('planner-history');
    await expect(history.locator('planner-history-day')).toHaveCount(7);
    const picker = history.getByLabel('Week containing', { exact: true });
    await picker.fill('06/05/2026');
    await picker.blur();
    await expect(page).toHaveURL(/week=2026-05-04/);
    const row = history
      .locator('[data-day="2026-05-06"] .history-task')
      .filter({ hasText: title });
    await expect(row).toBeVisible();

    await history.getByRole('button', { name: 'Previous week', exact: true }).click();
    await expect(page).toHaveURL(/week=2026-04-27/);
    await expect(history.locator('planner-history-day')).toHaveCount(7);
    await expect(history.locator('.history-task')).toHaveCount(0);
    await history.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect(row).toBeVisible();
    await page.reload();
    await expect(row).toBeVisible();
    await history.getByRole('button', { name: 'Previous week', exact: true }).click();
    await expect(page).toHaveURL(/week=2026-04-27/);
    await page.goBack();
    await expect(page).toHaveURL(/week=2026-05-04/);
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator('dialog-view-archived-task')).toContainText(title);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goForward();
    await expect(page).toHaveURL(/week=2026-04-27/);
    await expect(history.locator('.history-task')).toHaveCount(0);
  });

  touchTest(
    'opens History from the mobile sidebar and keeps the stacked week view usable',
    async ({ page }) => {
      await page.goto('/#/planner');
      await page
        .locator('mobile-bottom-nav')
        .getByRole('button', { name: 'Project Menu', exact: true })
        .tap();
      const sidebar = page.locator('magic-side-nav .nav-sidenav');
      await expect(sidebar).toBeVisible();
      const plannerNavItem = sidebar
        .locator('nav-item')
        .filter({ has: page.locator('a[href="#/planner"]') });
      await plannerNavItem
        .getByRole('button', { name: 'More actions', exact: true })
        .tap();
      await page.getByRole('menuitem', { name: 'History', exact: true }).tap();
      await expect(sidebar).toBeHidden();
      const history = page.locator('planner-history');
      await expect(history.locator('planner-history-day')).toHaveCount(7);
      await expect(history.getByLabel('Week containing', { exact: true })).toBeVisible();
      const days = history.locator('planner-history-day');
      // Route entry briefly scales the view. Measure the settled layout.
      await expect
        .poll(async () => (await days.first().boundingBox())?.width ?? Infinity)
        .toBeLessThanOrEqual(360);
      const first = await days.nth(0).boundingBox();
      const second = await days.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second!.y).toBeGreaterThan(first!.y);
      expect(first!.width).toBeLessThanOrEqual(360);
      await history.getByRole('button', { name: 'Previous week', exact: true }).tap();
      const nextWeek = history.getByRole('button', { name: 'Next week', exact: true });
      await expect(nextWeek).toBeEnabled();
      // The picker must not cover the arrow, including when it becomes enabled.
      await nextWeek.tap();
      await expect(nextWeek).toBeDisabled();
      await history.getByRole('link', { name: 'Back to Planner' }).tap();
      await expect(page).toHaveURL(/\/planner$/);
    },
  );
});
