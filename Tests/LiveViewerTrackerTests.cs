using BidNet.Hubs;
using Xunit;

namespace BidNet.Tests;

public class LiveViewerTrackerTests
{
    [Fact]
    public void JoinCountsEachConnectionOnlyOncePerEvent()
    {
        var tracker = new LiveViewerTracker();

        Assert.Equal(1, tracker.Join(10, "connection-a"));
        Assert.Equal(1, tracker.Join(10, "connection-a"));
        Assert.Equal(2, tracker.Join(10, "connection-b"));
        Assert.Equal(1, tracker.Join(20, "connection-a"));
        Assert.Equal(2, tracker.Count(10));
        Assert.Equal(1, tracker.Count(20));
    }

    [Fact]
    public void LeaveAllRemovesConnectionFromEveryEvent()
    {
        var tracker = new LiveViewerTracker();
        tracker.Join(10, "connection-a");
        tracker.Join(10, "connection-b");
        tracker.Join(20, "connection-a");

        var left = tracker.LeaveAll("connection-a");

        Assert.Equal(1, tracker.Count(10));
        Assert.Equal(0, tracker.Count(20));
        Assert.Collection(left,
            item => { Assert.Equal(10, item.EventId); Assert.Equal(1, item.Count); },
            item => { Assert.Equal(20, item.EventId); Assert.Equal(0, item.Count); });
    }
}
