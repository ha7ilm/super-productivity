import { test, expect } from '../../fixtures/test.fixture';
import { PlannerPage } from '../../pages/planner.page';
import { waitForMenuSettled, waitForStatePersistence } from '../../utils/waits';

test.describe('Planner Time Estimates', () => {
  let plannerPage: PlannerPage;

  test.beforeEach(async ({ page, workViewPage }) => {
    plannerPage = new PlannerPage(page);
    await workViewPage.waitForTaskList();
  });

  test('logs 25-minute increments and preserves Planner progress after reload', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const title = `${testPrefix}-Estimated task`;
    await workViewPage.addTask(`${title} t100m`, false, title);
    await plannerPage.navigateToPlanner();
    const card = page.locator('planner-task').filter({ hasText: title });
    const progress = card.getByRole('progressbar');
    await expect(card).toBeVisible();
    await expect(progress).toHaveCount(0);

    for (const percentage of [25, 50]) {
      await card.click({ button: 'right' });
      await waitForMenuSettled(page);
      const menuItems = page
        .getByRole('menuitem')
        .filter({ has: page.locator('span.menuItemLeft') });
      await expect(menuItems.nth(0)).toContainText('Log 25 minutes');
      await expect(menuItems.nth(1)).toContainText('Start tracking time');
      await page.getByRole('menuitem', { name: 'Log 25 minutes', exact: true }).click();

      await expect(progress).toHaveAttribute('aria-valuenow', String(percentage));
      await expect(card.locator('.time-progress-fill')).toHaveCSS('height', '2px');
      await expect(card).not.toHaveClass(/isCurrent/);
    }

    await waitForStatePersistence(page);
    await page.reload();
    await expect(progress).toHaveAttribute('aria-valuenow', '50');

    // The shared menu also makes the same action available in the normal task list.
    await page.goto('/#/tag/TODAY/tasks');
    await workViewPage.waitForTaskList();
    await page.locator('task').filter({ hasText: title }).click({ button: 'right' });
    await waitForMenuSettled(page);
    await page.getByRole('menuitem', { name: 'Log 25 minutes', exact: true }).click();
    await plannerPage.navigateToPlanner();
    await expect(progress).toHaveAttribute('aria-valuenow', '75');
  });

  test('should handle tasks with time estimate syntax', async ({
    page,
    workViewPage,
  }) => {
    // Add task with time estimate using short syntax
    await workViewPage.addTask('Important task /2h/');

    // Verify task was created (auto-retries until count matches)
    await expect(page.locator('task')).toHaveCount(1);

    // Task should contain the time estimate in title
    await expect(page.locator('task').first()).toContainText('Important task');
  });

  test('should navigate to planner with time estimated tasks', async ({
    page,
    workViewPage,
  }) => {
    // Add multiple tasks with time references
    await workViewPage.addTask('First task /1h/');
    await workViewPage.addTask('Second task /30m/');
    await workViewPage.addTask('Third task /2h/');

    // Verify all tasks created (auto-retries until count matches)
    await expect(page.locator('task')).toHaveCount(3);

    // Navigate to planner
    await plannerPage.navigateToPlanner();
    await plannerPage.waitForPlannerView();

    // Should be on planner or tasks view
    await expect(page).toHaveURL(/\/(planner|tasks)/);
  });

  test('should handle navigation with time estimated tasks', async ({
    page,
    workViewPage,
  }) => {
    // Add task with time estimate syntax
    await workViewPage.addTask('Development work /4h/');

    // Navigate to planner
    await plannerPage.navigateToPlanner();
    await plannerPage.waitForPlannerView();

    // Verify navigation successful
    await expect(page).toHaveURL(/\/(planner|tasks)/);
    await expect(plannerPage.routerWrapper).toBeVisible();
  });

  test('should preserve tasks with time info when navigating', async ({
    page,
    workViewPage,
  }) => {
    // Add tasks with various time formats
    await workViewPage.addTask('Quick fix /15m/');
    await workViewPage.addTask('Feature development /3h30m/');

    // Navigate to planner
    await plannerPage.navigateToPlanner();
    await plannerPage.waitForPlannerView();

    // Go back to work view
    await page.goto('/#/tag/TODAY/tasks');
    await workViewPage.waitForTaskList();

    // Tasks should still be there
    await expect(page.locator('task')).toHaveCount(2);
    await expect(page.locator('task').first()).toContainText('Feature development');
    await expect(page.locator('task').last()).toContainText('Quick fix');
  });
});
