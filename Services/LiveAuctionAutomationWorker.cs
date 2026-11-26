namespace BidNet.Services;

public class LiveAuctionAutomationWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<LiveAuctionAutomationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var live = scope.ServiceProvider.GetRequiredService<LiveAuctionService>();
                await live.ProcessAutomationTickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Không xử lý được tác vụ tự động của phiên đấu giá trực tiếp.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        } while (true);
    }
}
