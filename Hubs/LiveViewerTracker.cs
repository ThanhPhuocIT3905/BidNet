namespace BidNet.Hubs;

public sealed class LiveViewerTracker
{
    private readonly object sync = new();
    private readonly Dictionary<int, HashSet<string>> connectionsByEvent = [];
    private readonly Dictionary<string, HashSet<int>> eventsByConnection = [];

    public int Join(int eventId, string connectionId)
    {
        lock (sync)
        {
            if (!eventsByConnection.TryGetValue(connectionId, out var eventIds))
            {
                eventIds = [];
                eventsByConnection.Add(connectionId, eventIds);
            }

            if (!eventIds.Add(eventId))
                return connectionsByEvent[eventId].Count;

            if (!connectionsByEvent.TryGetValue(eventId, out var connections))
            {
                connections = [];
                connectionsByEvent.Add(eventId, connections);
            }

            connections.Add(connectionId);
            return connections.Count;
        }
    }

    public int Leave(int eventId, string connectionId)
    {
        lock (sync)
        {
            RemoveConnection(eventId, connectionId);
            return connectionsByEvent.TryGetValue(eventId, out var connections) ? connections.Count : 0;
        }
    }

    public IReadOnlyList<(int EventId, int Count)> LeaveAll(string connectionId)
    {
        lock (sync)
        {
            if (!eventsByConnection.TryGetValue(connectionId, out var eventIds))
                return [];

            var counts = new List<(int EventId, int Count)>(eventIds.Count);
            foreach (var eventId in eventIds.ToArray())
            {
                RemoveConnection(eventId, connectionId);
                counts.Add((eventId, connectionsByEvent.TryGetValue(eventId, out var connections) ? connections.Count : 0));
            }

            return counts;
        }
    }

    public int Count(int eventId)
    {
        lock (sync)
            return connectionsByEvent.TryGetValue(eventId, out var connections) ? connections.Count : 0;
    }

    private void RemoveConnection(int eventId, string connectionId)
    {
        if (connectionsByEvent.TryGetValue(eventId, out var connections))
        {
            connections.Remove(connectionId);
            if (connections.Count == 0)
                connectionsByEvent.Remove(eventId);
        }

        if (eventsByConnection.TryGetValue(connectionId, out var eventIds))
        {
            eventIds.Remove(eventId);
            if (eventIds.Count == 0)
                eventsByConnection.Remove(connectionId);
        }
    }
}
