import DigestBlockList from "./components/DigestBlockList";

export default async function page() {
    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <DigestBlockList />
        </div>
    );
}
