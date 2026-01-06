export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                {/* Simple pulsing loader */}
                <div className="relative">
                    <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                </div>
            </div>
        </div>
    );
}
