namespace HelmsDeep
{
    public sealed class TurretGrid : UnityEngine.MonoBehaviour
    {
        public TurretSocket[] Sockets { get; private set; } = System.Array.Empty<TurretSocket>();

        public void Configure(TurretSocket[] sockets) => Sockets = sockets;

        public void ResetSockets()
        {
            foreach (var socket in Sockets)
            {
                socket?.ResetSocket();
            }
        }

        public void Highlight(int selectedId)
        {
            foreach (var socket in Sockets)
            {
                if (socket == null) continue;
                socket.SetHighlight(socket.Id == selectedId);
            }
        }

        public bool TryBuild(int socketId, TurretType type)
        {
            if (socketId < 0 || socketId >= Sockets.Length) return false;
            return Sockets[socketId].TryBuild(type);
        }
    }
}
