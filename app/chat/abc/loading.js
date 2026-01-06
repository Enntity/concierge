export default function Loading() {
    return (
        <div className="flex-1 bg-slate-900 flex items-center justify-center min-h-[50vh]">
            <div className="relative">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            </div>
        </div>
    );
}
